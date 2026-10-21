"""Alignment check before data collection. Grabs a few camera frames, and for the
largest face saves to DATA_DIR/debug/: the frame with numbered YuNet landmarks,
the SFace aligned crop and the AuraFace aligned crop (upscaled side by side).
Look at them on the kiosk: eyes level and centred, landmark 0 on the image-left eye.

  python align_check.py [--shots 3]
"""
from __future__ import annotations

import argparse
import time

import cv2
import numpy as np

from common import DATA_DIR, AuraFaceModel, Detector, SFaceModel, largest_face, landmarks, open_camera, save_image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", type=int, default=3)
    ap.add_argument("--camera", type=int, default=0)
    args = ap.parse_args()

    det, sface, aura = Detector(), SFaceModel(), AuraFaceModel()
    cap = open_camera(args.camera, 1920, 1080)
    out = DATA_DIR / "debug"
    shot = 0
    try:
        for _ in range(30):  # let exposure settle
            cap.read()
        while shot < args.shots:
            ok, frame = cap.read()
            if not ok:
                raise SystemExit("camera read failed")
            face = largest_face(det.detect(frame))
            if face is None:
                continue
            marked = frame.copy()
            for i, (x, y) in enumerate(landmarks(face)):
                cv2.circle(marked, (int(x), int(y)), 3, (0, 0, 255), -1)
                cv2.putText(marked, str(i), (int(x) + 4, int(y) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            pair = np.hstack([sface.align(frame, face), aura.align(frame, face)])
            pair = cv2.resize(pair, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)
            cv2.line(pair, (0, int(51.6 * 3)), (pair.shape[1], int(51.6 * 3)), (0, 255, 0), 1)  # template eye line
            save_image(out / f"landmarks_{shot}.jpg", marked)
            p = save_image(out / f"aligned_{shot}_sface_left_auraface_right.jpg", pair)
            print("saved", p)
            shot += 1
            time.sleep(0.5)
    finally:
        cap.release()


if __name__ == "__main__":
    main()
