# UC-04 kiosk screen — manual test run (2026-10-21)

Manual test of the kiosk screen (`docs/usecases/UC-04-kiosk-screen.md`) on the phase 1 kiosk machine, using touch, headphones and loudspeakers.

**Status: partial run.** T1, T2 and V1–V4 were tested; T3–T7, V5–V15 and the latency measurements are still pending and need a second session.

## Setup facts

| Item | Value |
|---|---|
| Date | 2026-10-21 |
| Branch / commit | `feature/UC-04-kiosk-screen` @ `be3cd38` (`main` = `e68c876`, does not contain `be3cd38`) |
| CPU | Intel N100 |
| RAM | 7.8 GB |
| OS | Windows 11 Pro 25H2, build 26200.9711 |
| Tools | git 2.55.0, Docker Engine 29.9.1, Docker Compose v5.6.0, Node v26.8.1 (installed for this run) |
| Containers | `api` (built from branch), `db` (`postgres:16-alpine`), migrations `20261019_1400`, `20261020_0900` applied, seed applied |
| Gemini key | Set from a local `.env` (git-ignored), not in the repo |
| Browser | _pending_ |
| URL checks | `/` 200, `/menu` 200, `/q/?order=e0000000-0000-4000-8000-000000000401` 200 |
| Setup issue | Bug B1: `npm run migrate` / `npm run seed` fail on a Windows clone (CRLF) |

## Touch flow

| ID | Check | Result | Note |
|---|---|---|---|
| T1 | `เริ่มสั่ง` → menu shows; มัทฉะลาเต้ greyed out and cannot be tapped | Pass | Tester reported the touch order flow works. |
| T2 | ลาเต้ → L + นมโอ๊ต + quantity 2 → `ใส่ตะกร้า` → cart shows 160.00 | Pass | Tester reported the touch order flow works. |
| T3 | อเมริกาโน่ without a size → `กรุณาเลือกขนาด`, nothing added | _pending_ | |
| T4 | + / ลบ change the cart; total matches the screen | _pending_ | |
| T5 | `ยืนยัน` → `ยืนยันสั่ง` twice fast → one queue number and a QR that opens the status page | _pending_ | |
| T6 | Queue screen returns to Welcome after 30 s; `เสร็จสิ้น` returns at once | _pending_ | |
| T7 | Order screen idle 2 min → `ยังสั่งอยู่ไหม`; tap keeps cart; idle 15 s more → Welcome | _pending_ | |

## Voice flow

| ID | Check | Result | Note |
|---|---|---|---|
| V1 | 🎤 → consent sheet; `ยินยอม` and `ไม่ใช่ตอนนี้` same size; `ไม่ใช่ตอนนี้` closes it | Pass | Headphones. Tester reported V1–V4 all work. |
| V2 | `ยินยอม` → mic allowed → `กำลังเชื่อมต่อ…` then `⏹ หยุดเสียง`; captions 👤 / 🤖 | Pass | Headphones. Gemini key accepted (voice session connected). |
| V3 | "ลาเต้แก้วใหญ่ นมโอ๊ต สองแก้ว" → added, cart updates, says 160 บาท | Pass | Headphones. |
| V4 | "อเมริกาโน่หนึ่งแก้ว" → asks size first, adds nothing until answered | Pass | Headphones. |
| V5 | "มัทฉะลาเต้" → sold out, suggests another drink | _pending_ | |
| V6 | "ชานมไข่มุก" → shop does not have it, no guessing | _pending_ | |
| V7 | "เปลี่ยนลาเต้เป็นแก้วเดียว" then "เอาออก" → right line changed, then removed | _pending_ | |
| V8 | "พอแล้ว จ่ายเงิน" → confirm screen, asks to tap, never confirms itself | _pending_ | |
| V9 | Interrupt while it speaks → audio stops at once, no stale audio later | _pending_ | |
| V10 | Loudspeakers: does it hear itself and cut itself off? | _pending_ | |
| V11 | `⏹ หยุดเสียง` → mic indicator off at once, cart unchanged; 🎤 again → no consent sheet | _pending_ | |
| V12 | Mic blocked → 🎤 → `ใช้เสียงไม่ได้ตอนนี้ สั่งด้วยการแตะได้เลย`, touch still works | _pending_ | |
| V13 | Network unplugged during voice → same notice, touch works with same cart | _pending_ | |
| V14 | DevTools Console/Network: no API key, token not printed in console | _pending_ | |
| V15 | Audio quality: own voice understood; reply clear (crackle / robotic?) | _pending_ | |

## Measurements

| Measurement | Try 1 | Try 2 | Try 3 | Note |
|---|---|---|---|---|
| `ยินยอม` → `⏹ หยุดเสียง` (s) | | | | |
| End of sentence → first reply audio (s) | | | | |

| Container | CPU % | RAM | Note |
|---|---|---|---|
| `api` (voice on) | 0.1–9.4 % (mostly < 1 %) | 97–99 MiB | Sampled every ~6 s during V1–V4. Audio goes browser ↔ Gemini directly; `api` only serves token and function calls. |
| `db` (voice on) | 0–6.2 % | 35–40 MiB | Same samples. |

Docker Desktop's WSL VM was capped at 3.715 GiB of the machine's 7.8 GB; its own overhead is not in these numbers.

## Bugs

### B1: migrate and seed fail on a fresh Windows clone

- **Steps:** On Windows with Git for Windows defaults (`core.autocrlf=true`), clone the repo, `docker compose up -d db`, run `npm run migrate` (or `npm run seed`).
- **Expected:** Migrations apply and the seed runs, as in `README.md`.
- **Actual:** Both exit with code 2: `/db/scripts/migrate.sh: set: line 3: illegal option -` (same for `seed.sh`). The repo has no `.gitattributes`, so `db/scripts/*.sh` are checked out with CRLF line endings and the Alpine `sh` reads `set -…\r`.
- **Workaround used in this run:** `git config core.autocrlf false` in the clone, then re-checkout. No tracked file changed.
