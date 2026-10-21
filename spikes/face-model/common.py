"""Shared pipeline for the face-model spike: paths guard, YuNet detection,
quality gate, alignment and embedding for SFace and AuraFace.

Biometric data (frames, crops, embeddings) may only be written under DATA_DIR,
which is outside the repo. safe_path() enforces this for every write.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

DATA_DIR = Path(os.environ.get("FACE_SPIKE_DATA", r"C:\face-spike-data")).resolve()
MODELS_DIR = DATA_DIR / "models"
REPO_ROOT = Path(__file__).resolve().parents[2]

YUNET_FILE = "face_detection_yunet_2023mar.onnx"
SFACE_FILE = "face_recognition_sface_2021dec.onnx"
AURAFACE_FILE = "glintr100.onnx"

# Standard ArcFace 5-point template for a 112x112 crop, in image order:
# image-left eye, image-right eye, nose, image-left mouth corner, image-right mouth corner.
ARCFACE_TEMPLATE = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


class UnsafePathError(RuntimeError):
    pass


def safe_path(path: str | Path) -> Path:
    """Return path resolved, or raise if it is inside the repo or outside DATA_DIR."""
    p = Path(path).resolve()
    if p == REPO_ROOT or REPO_ROOT in p.parents:
        raise UnsafePathError(f"refusing to write biometric data inside the repo: {p}")
    if p != DATA_DIR and DATA_DIR not in p.parents:
        raise UnsafePathError(f"refusing to write outside {DATA_DIR}: {p}")
    return p


def assert_data_dir_outside_repo() -> None:
    if DATA_DIR == REPO_ROOT or REPO_ROOT in DATA_DIR.parents:
        raise UnsafePathError(f"FACE_SPIKE_DATA points inside the repo: {DATA_DIR}")


assert_data_dir_outside_repo()


def save_image(path: str | Path, img: np.ndarray) -> Path:
    p = safe_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(p), img):
        raise OSError(f"could not write {p}")
    return p


def save_array(path: str | Path, arr: np.ndarray) -> Path:
    p = safe_path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    np.save(p, arr)
    return p


def open_camera(index: int = 0, width: int = 1280, height: int = 720) -> cv2.VideoCapture:
    # On the kiosk camera, MSMF + MJPG gives 30 fps; DSHOW stays on YUY2 at about 5 fps.
    for api in (cv2.CAP_MSMF, cv2.CAP_DSHOW):
        cap = cv2.VideoCapture(index, api)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            cap.set(cv2.CAP_PROP_FPS, 30)
            return cap
        cap.release()
    raise RuntimeError(f"camera {index} could not be opened (MSMF and DSHOW tried)")


# ---------- detection and quality gate ----------

@dataclass
class QualityGate:
    min_width: int = 80
    min_sharpness: float = 60.0  # variance of Laplacian on the grey face crop
    # 95th-percentile grey level of the face crop (0-255). Not the mean: mean
    # brightness also depends on skin tone, and a mean threshold of 50 rejected
    # every frame of a face YuNet found at score 0.94. p95 tests exposure.
    min_brightness: float = 40.0
    min_score: float = 0.9

    def check(self, img: np.ndarray, face: np.ndarray) -> str | None:
        """Return None if the face passes, else the reason it was skipped."""
        x, y, w, h = face[:4]
        if face[14] < self.min_score:
            return "low_score"
        if w < self.min_width:
            return "too_small"
        x0, y0 = max(int(x), 0), max(int(y), 0)
        x1, y1 = min(int(x + w), img.shape[1]), min(int(y + h), img.shape[0])
        crop = img[y0:y1, x0:x1]
        if crop.size == 0:
            return "out_of_frame"
        grey = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        if np.percentile(grey, 95) < self.min_brightness:
            return "too_dark"
        if cv2.Laplacian(grey, cv2.CV_64F).var() < self.min_sharpness:
            return "too_blurry"
        return None


class Detector:
    """YuNet. Each face row: x, y, w, h, 5 landmarks (x, y) pairs, score.

    Detection runs on a copy downscaled to detect_width; coordinates are mapped
    back to the full frame. On the kiosk camera, close faces at full 1080p got a
    median score of 0.86 versus 0.91 at 720p (YuNet favours smaller faces)."""

    def __init__(self, score_threshold: float = 0.6, detect_width: int | None = 1280):
        self.detect_width = detect_width
        self.net = cv2.FaceDetectorYN.create(
            str(MODELS_DIR / YUNET_FILE), "", (320, 320), score_threshold, 0.3, 5000
        )

    def detect(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        scale = 1.0
        if self.detect_width and w > self.detect_width:
            scale = self.detect_width / w
            img = cv2.resize(img, (self.detect_width, round(h * scale)), interpolation=cv2.INTER_AREA)
        self.net.setInputSize((img.shape[1], img.shape[0]))
        _, faces = self.net.detect(img)
        if faces is None:
            return np.empty((0, 15), np.float32)
        faces = faces.copy()
        faces[:, :14] /= scale
        return faces


def largest_face(faces: np.ndarray) -> np.ndarray | None:
    if len(faces) == 0:
        return None
    return faces[np.argmax(faces[:, 2] * faces[:, 3])]


def landmarks(face: np.ndarray) -> np.ndarray:
    return face[4:14].reshape(5, 2).astype(np.float32)


# ---------- recognition ----------

def l2_normalise(v: np.ndarray) -> np.ndarray:
    v = v.astype(np.float32).ravel()
    return v / max(np.linalg.norm(v), 1e-12)


class SFaceModel:
    name = "sface"

    def __init__(self):
        self.rec = cv2.FaceRecognizerSF.create(str(MODELS_DIR / SFACE_FILE), "")

    def align(self, img: np.ndarray, face: np.ndarray) -> np.ndarray:
        return self.rec.alignCrop(img, face)

    def embed(self, aligned: np.ndarray) -> np.ndarray:
        return l2_normalise(self.rec.feature(aligned))


class AuraFaceModel:
    """AuraFace v1 (glintr100.onnx). The graph has no built-in normalisation, so,
    as InsightFace's ArcFaceONNX does for such models: RGB, (x - 127.5) / 127.5."""

    name = "auraface"

    def __init__(self, threads: int | None = None):
        import onnxruntime as ort

        opts = ort.SessionOptions()
        if threads:
            opts.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(
            str(MODELS_DIR / AURAFACE_FILE), opts, providers=["CPUExecutionProvider"]
        )
        self.input_name = self.sess.get_inputs()[0].name

    def align(self, img: np.ndarray, face: np.ndarray) -> np.ndarray:
        m, _ = cv2.estimateAffinePartial2D(landmarks(face), ARCFACE_TEMPLATE, method=cv2.LMEDS)
        return cv2.warpAffine(img, m, (112, 112), borderValue=0.0)

    def embed(self, aligned: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB).astype(np.float32)
        x = ((rgb - 127.5) / 127.5).transpose(2, 0, 1)[None]
        return l2_normalise(self.sess.run(None, {self.input_name: x})[0])


def load_models(names: list[str]) -> list:
    table = {"sface": SFaceModel, "auraface": AuraFaceModel}
    return [table[n]() for n in names]
