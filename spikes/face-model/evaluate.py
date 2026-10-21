"""Evaluate detection and recognition for both models on the captured frames.
Prints numbers only; embeddings are cached under DATA_DIR/embeddings.

  python evaluate.py [--models sface auraface] [--json out.json]

Per person: session 1 = enrolment (mean of its frame embeddings, L2-normalised),
other sessions = probes (one embedding per frame that passes the quality gate).
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict

import cv2
import numpy as np

from common import DATA_DIR, Detector, QualityGate, l2_normalise, largest_face, load_models, safe_path, save_array


def load_sessions():
    sessions = []
    for meta_path in sorted((DATA_DIR / "frames").glob("*/s*/session.json")):
        meta = json.loads(meta_path.read_text())
        meta["frames_paths"] = sorted(meta_path.parent.glob("*.jpg"))
        sessions.append(meta)
    return sessions


def detection_stats(sessions, det, gate):
    """Per session: frames, faces found, gate reasons. SCENE: false detections."""
    faces_by_frame = {}
    rows = []
    for s in sessions:
        reasons = Counter()
        extra = 0
        for fp in s["frames_paths"]:
            img = cv2.imread(str(fp))
            faces = det.detect(img)
            if s["id"] == "SCENE":
                extra += len(faces)
                continue
            extra += max(len(faces) - 1, 0)
            face = largest_face(faces)
            if face is None:
                reasons["no_face"] += 1
                continue
            r = gate.check(img, face)
            reasons[r or "pass"] += 1
            if r is None:
                faces_by_frame[str(fp)] = face
        rows.append({"id": s["id"], "session": s["session"], "distance_m": s.get("distance_m"),
                     "light": s["light"], "glasses": s["glasses"], "mask": s["mask"],
                     "frames": len(s["frames_paths"]), "reasons": dict(reasons), "extra_faces": extra})
    return rows, faces_by_frame


def embed_all(model, sessions, faces_by_frame):
    """{(id, session): array of frame embeddings}, cached per model."""
    out = {}
    for s in sessions:
        if s["id"] == "SCENE":
            continue
        cache = safe_path(DATA_DIR / "embeddings" / model.name / s["id"] / f"s{s['session']}.npy")
        paths = [fp for fp in s["frames_paths"] if str(fp) in faces_by_frame]
        if cache.exists():
            embs = np.load(cache)
            if len(embs) == len(paths):
                out[(s["id"], s["session"])] = embs
                continue
        embs = []
        for fp in paths:
            img = cv2.imread(str(fp))
            embs.append(model.embed(model.align(img, faces_by_frame[str(fp)])))
        embs = np.array(embs, np.float32).reshape(len(embs), -1)
        save_array(cache, embs)
        out[(s["id"], s["session"])] = embs
    return out


def score(embs, sessions):
    meta = {(s["id"], s["session"]): s for s in sessions if s["id"] != "SCENE"}
    people = sorted({pid for pid, _ in embs})
    enrol = {}
    for pid in people:
        first = min(sess for p, sess in embs if p == pid)
        if len(embs[(pid, first)]):
            enrol[pid] = l2_normalise(embs[(pid, first)].mean(axis=0))
    ids = sorted(enrol)
    enrol_mat = np.array([enrol[p] for p in ids])
    genuine, impostor, rank1 = [], [], []
    for (pid, sess), e in embs.items():
        if pid not in enrol or sess == min(s for p, s in embs if p == pid) or not len(e):
            continue
        sims = e @ enrol_mat.T  # frames x people
        own = ids.index(pid)
        tags = meta[(pid, sess)]
        for row in sims:
            genuine.append({"score": float(row[own]), "light": tags["light"], "distance_m": tags.get("distance_m"),
                            "glasses": tags["glasses"], "mask": tags["mask"], "id": pid})
            impostor.extend(float(v) for i, v in enumerate(row) if i != own)
            if len(ids) > 1:
                rank1.append(int(np.argmax(row) == own))
    return genuine, impostor, rank1, len(ids)


def error_rates(gen, imp):
    g, i = np.array(gen), np.array(imp)
    res = {"genuine_n": len(g), "impostor_n": len(i)}
    if not len(g) or not len(i):
        return res
    ths = np.unique(np.concatenate([g, i]))
    far = np.array([(i >= t).mean() for t in ths])
    frr = np.array([(g < t).mean() for t in ths])
    k = int(np.argmin(np.abs(far - frr)))
    res.update(eer=float((far[k] + frr[k]) / 2), eer_threshold=float(ths[k]))
    ok = np.where(far <= 0.001)[0]
    if len(ok):
        j = ok[0]
        res.update(threshold_far_0_1pct=float(ths[j]), far_at=float(far[j]), frr_at=float(frr[j]))
    res["table"] = [{"threshold": float(t), "far": float((i >= t).mean()), "frr": float((g < t).mean())}
                    for t in np.round(np.arange(0.0, 1.0001, 0.05), 2)]
    return res


def summary(values):
    v = np.array(values)
    if not len(v):
        return "n=0"
    return f"n={len(v)} mean={v.mean():.3f} min={v.min():.3f} p5={np.percentile(v, 5):.3f} median={np.median(v):.3f} max={v.max():.3f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["sface", "auraface"])
    ap.add_argument("--json", help="write full results (numbers only) to this path under DATA_DIR")
    args = ap.parse_args()

    sessions = load_sessions()
    det, gate = Detector(), QualityGate()
    det_rows, faces_by_frame = detection_stats(sessions, det, gate)
    results = {"detection": det_rows, "models": {}}

    print("== detection / quality gate ==")
    for r in det_rows:
        print(f"{r['id']}/s{r['session']} {r['distance_m']} {r['light']}: frames {r['frames']} {r['reasons']} extra faces {r['extra_faces']}")
    by = defaultdict(Counter)
    for r in det_rows:
        if r["id"] == "SCENE":
            continue
        for key in (f"distance {r['distance_m']}", f"light {r['light']}"):
            by[key]["frames"] += r["frames"]
            by[key]["detected"] += r["frames"] - r["reasons"].get("no_face", 0)
            by[key]["pass"] += r["reasons"].get("pass", 0)
    for key, c in sorted(by.items()):
        print(f"  {key}: detection {c['detected']}/{c['frames']}  gate pass {c['pass']}/{c['frames']}")

    for model in load_models(args.models):
        embs = embed_all(model, sessions, faces_by_frame)
        gen, imp, rank1, n_people = score(embs, sessions)
        rates = error_rates([x["score"] for x in gen], imp)
        print(f"\n== {model.name} ({n_people} enrolled) ==")
        print("genuine :", summary([x["score"] for x in gen]))
        print("impostor:", summary(imp))
        for key in ("light", "distance_m", "glasses", "mask"):
            groups = defaultdict(list)
            for x in gen:
                groups[x[key]].append(x["score"])
            if len(groups) > 1:
                for k, v in sorted(groups.items(), key=lambda kv: str(kv[0])):
                    print(f"  genuine {key}={k}: {summary(v)}")
        if "eer" in rates:
            print(f"EER {rates['eer']:.2%} at threshold {rates['eer_threshold']:.3f}")
            if "threshold_far_0_1pct" in rates:
                print(f"FAR<=0.1% at threshold {rates['threshold_far_0_1pct']:.3f}: FAR {rates['far_at']:.3%} FRR {rates['frr_at']:.2%}"
                      f" (rests on {rates['impostor_n']} impostor scores)")
        else:
            print("no impostor pairs yet: FAR/FRR/EER need at least 2 enrolled people")
        if rank1:
            print(f"rank-1: {np.mean(rank1):.2%} ({sum(rank1)}/{len(rank1)} probe frames)")
        results["models"][model.name] = {"n_people": n_people, "rates": rates, "rank1": rank1 and float(np.mean(rank1)),
                                         "genuine": gen, "impostor_summary": summary(imp)}

    if args.json:
        p = safe_path(DATA_DIR / args.json)
        p.write_text(json.dumps(results, indent=1, default=str))
        print("\nwrote", p)


if __name__ == "__main__":
    main()
