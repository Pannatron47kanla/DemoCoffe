"""Capture tool. Shows a live preview with the YuNet box, then saves full frames
for one session under DATA_DIR/frames/<id>/s<session>/ with a session.json of tags.

Person session (press SPACE to start, Q to quit):
  python capture.py --id P01 --session 1 --distance 1.0 --light normal [--glasses] [--mask]
Empty scene / people walking past (records --seconds at --fps):
  python capture.py --id SCENE --session 1 --light normal --seconds 120
"""
from __future__ import annotations

import argparse
import json
import re
import time

import cv2

from common import DATA_DIR, Detector, QualityGate, largest_face, open_camera, safe_path, save_image

ID_RE = re.compile(r"^(P\d{2}|SCENE)$")


def draw(frame, faces, gate):
    view = frame.copy()
    for f in faces:
        reason = gate.check(frame, f)
        colour = (0, 200, 0) if reason is None else (0, 140, 255)
        x, y, w, h = map(int, f[:4])
        cv2.rectangle(view, (x, y), (x + w, y + h), colour, 2)
        cv2.putText(view, reason or f"ok {int(w)}px", (x, max(y - 8, 12)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, colour, 2)
    return view


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True, help="P01..P99 or SCENE (no names)")
    ap.add_argument("--session", type=int, required=True)
    ap.add_argument("--distance", type=float, choices=[0.5, 1.0, 1.5])
    ap.add_argument("--light", required=True, choices=["normal", "backlight", "dim"])
    ap.add_argument("--glasses", action="store_true")
    ap.add_argument("--mask", action="store_true")
    ap.add_argument("--frames", type=int, default=30)
    ap.add_argument("--seconds", type=int, default=0, help="SCENE only: record this long")
    ap.add_argument("--fps", type=float, default=5.0, help="save rate")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--auto", action="store_true",
                    help="start saving once a face has passed the gate for 1 s (SCENE: start at once)")
    ap.add_argument("--timeout", type=float, default=120, help="give up if nothing saved after this many seconds")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    args = ap.parse_args()

    if not ID_RE.match(args.id):
        ap.error("--id must be P01..P99 or SCENE; never a name")
    if args.id != "SCENE" and args.distance is None:
        ap.error("--distance is required for a person session")

    out_dir = safe_path(DATA_DIR / "frames" / args.id / f"s{args.session}")
    if out_dir.exists() and any(out_dir.iterdir()):
        raise SystemExit(f"{out_dir} already has frames; pick another --session")

    det, gate = Detector(), QualityGate()
    cap = open_camera(args.camera, args.width, args.height)
    win =f"capture {args.id} s{args.session}  SPACE=start  Q=quit"
    target = args.seconds * args.fps if args.id == "SCENE" else args.frames
    saved, recording, last = 0, False, 0.0
    started, passing_since = time.perf_counter(), None
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                raise SystemExit("camera read failed")
            faces = det.detect(frame)
            if args.auto and not recording:
                face = largest_face(faces)
                passes = args.id == "SCENE" or (face is not None and gate.check(frame, face) is None)
                passing_since = (passing_since or time.perf_counter()) if passes else None
                if passing_since and time.perf_counter() - passing_since >= (0 if args.id == "SCENE" else 1.0):
                    recording, last = True, 0.0
            if not recording and time.perf_counter() - started > args.timeout:
                print(f"timed out after {args.timeout:.0f} s without a face passing the gate")
                break
            view = draw(frame, faces, gate)
            status = f"saved {saved}/{int(target)}" if recording else "press SPACE to start"
            cv2.putText(view, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            cv2.imshow(win, view)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
            if key == ord(" ") and not recording:
                recording, last = True, 0.0
            now = time.perf_counter()
            if recording and now - last >= 1.0 / args.fps:
                save_image(out_dir / f"{saved:04d}.jpg", frame)
                saved, last = saved + 1, now
                if saved >= target:
                    break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    if saved:
        meta = {
            "id": args.id, "session": args.session, "distance_m": args.distance,
            "light": args.light, "glasses": args.glasses, "mask": args.mask,
            "frames": saved, "resolution": [int(frame.shape[1]), int(frame.shape[0])],
            "fps": args.fps, "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        (safe_path(out_dir / "session.json")).write_text(json.dumps(meta, indent=2))
        largest = largest_face(det.detect(frame))
        print(f"saved {saved} frames to {out_dir}; last frame face width:",
              None if largest is None else int(largest[2]))
    else:
        print("nothing saved")


if __name__ == "__main__":
    main()
