"""Alignment check by numbers only; saves nothing. For each frame with a face:
landmark order (image-left eye first), residual of the AuraFace similarity
transform against the ArcFace template, and eye-line tilt in the aligned crop.

  python align_numeric.py [--frames 20] [--timeout 60]
"""
from __future__ import annotations

import argparse
import time

import cv2
import numpy as np

from common import ARCFACE_TEMPLATE, Detector, QualityGate, largest_face, landmarks, open_camera


def check(face: np.ndarray) -> dict:
    lm = landmarks(face)
    re, le, nose, mr, ml = lm
    order_ok = bool(re[0] < le[0] and re[0] < nose[0] < le[0]
                    and nose[1] > max(re[1], le[1]) and min(mr[1], ml[1]) > nose[1] and mr[0] < ml[0])
    m, _ = cv2.estimateAffinePartial2D(lm, ARCFACE_TEMPLATE, method=cv2.LMEDS)
    mapped = cv2.transform(lm[None], m)[0]
    resid = np.linalg.norm(mapped - ARCFACE_TEMPLATE, axis=1)
    tilt = np.degrees(np.arctan2(mapped[1, 1] - mapped[0, 1], mapped[1, 0] - mapped[0, 0]))
    rot = np.degrees(np.arctan2(m[1, 0], m[0, 0]))
    return {"order_ok": order_ok, "resid_mean": float(resid.mean()), "resid_max": float(resid.max()),
            "tilt_deg": float(tilt), "rotation_applied_deg": float(rot), "face_px": float(face[2])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, default=20)
    ap.add_argument("--timeout", type=float, default=60)
    args = ap.parse_args()

    det, gate = Detector(), QualityGate()
    cap = open_camera(0, 1920, 1080)
    rows, skipped, t0 = [], {}, time.perf_counter()
    try:
        while len(rows) < args.frames and time.perf_counter() - t0 < args.timeout:
            ok, frame = cap.read()
            if not ok:
                continue
            face = largest_face(det.detect(frame))
            if face is None:
                skipped["no_face"] = skipped.get("no_face", 0) + 1
                continue
            reason = gate.check(frame, face)
            if reason:
                skipped[reason] = skipped.get(reason, 0) + 1
                continue
            rows.append(check(face))
    finally:
        cap.release()

    print("frames checked:", len(rows), "| skipped:", skipped)
    if not rows:
        return
    for key in ("resid_mean", "resid_max", "tilt_deg", "rotation_applied_deg", "face_px"):
        v = np.array([r[key] for r in rows])
        print(f"{key:22s} mean {v.mean():7.2f}  min {v.min():7.2f}  max {v.max():7.2f}")
    print("landmark order ok:", sum(r["order_ok"] for r in rows), "/", len(rows))


if __name__ == "__main__":
    main()
