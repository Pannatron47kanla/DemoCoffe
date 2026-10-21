"""List captured sessions with tags, detection and quality-gate counts. Numbers only.

  python sessions.py [--id P01]
"""
from __future__ import annotations

import argparse
import json
from collections import Counter

import cv2
import numpy as np

from common import DATA_DIR, Detector, QualityGate, largest_face


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id")
    args = ap.parse_args()

    det, gate = Detector(), QualityGate()
    root = DATA_DIR / "frames"
    print(f"{'session':10s} {'dist':>5s} {'light':10s} {'gl':>2s} {'mk':>2s} {'frames':>6s} {'face':>5s} {'pass':>5s} {'width px':>9s}  skipped")
    for meta_path in sorted(root.glob(f"{args.id or '*'}/s*/session.json")):
        meta = json.loads(meta_path.read_text())
        reasons, widths = Counter(), []
        frames = sorted(meta_path.parent.glob("*.jpg"))
        for fp in frames:
            img = cv2.imread(str(fp))
            face = largest_face(det.detect(img))
            if face is None:
                reasons["no_face"] += 1
                continue
            widths.append(face[2])
            r = gate.check(img, face)
            reasons[r or "pass"] += 1
        n_face = len(frames) - reasons["no_face"]
        w = f"{np.median(widths):.0f}" if widths else "-"
        skipped = {k: v for k, v in reasons.items() if k not in ("pass", "no_face")}
        print(f"{meta['id'] + '/s' + str(meta['session']):10s} {str(meta.get('distance_m') or '-'):>5s} {meta['light']:10s}"
              f" {'y' if meta['glasses'] else '-':>2s} {'y' if meta['mask'] else '-':>2s} {len(frames):6d} {n_face:5d}"
              f" {reasons['pass']:5d} {w:>9s}  {skipped or ''}")


if __name__ == "__main__":
    main()
