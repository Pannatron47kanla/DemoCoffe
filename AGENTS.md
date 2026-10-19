# AGENTS.md

> ไฟล์นี้สำหรับ AI coding tool อื่น (Codex, Cursor ฯลฯ) เนื้อหาเหมือน CLAUDE.md ถ้าแก้ไฟล์หนึ่งให้แก้อีกไฟล์ด้วย
> ก่อนเริ่มฟีเจอร์ใหม่ อ่าน .claude/skills/feature-workflow/SKILL.md
> ก่อนสร้างหรือย้ายไฟล์ใน src/modules/ อ่าน .claude/skills/ddd-architecture/SKILL.md และ docs/architecture/context-map.md
> ก่อนร่าง Epic/Story/Sub-task อ่าน .claude/skills/jira-backlog/SKILL.md


## Workflow (Spec-First)
ทุกฟีเจอร์ใหม่ทำตามลำดับนี้ อ่าน `.claude/skills/feature-workflow/SKILL.md` เมื่อเริ่มฟีเจอร์ใหม่
1. Use case + acceptance criteria (AC) ใน `docs/usecases/`
2. Database (migration) คู่กับ API spec (`openapi.yaml`)
3. Mock server + seed data
4. แบ่งงานตาม use case
5. Dev แบบ TDD
6. Integration test + CI

## ใช้ร่วมกับ Superpowers (obra/superpowers)
ไฟล์นี้มีลำดับความสำคัญสูงกว่า skill ของ Superpowers ถ้าขัดกันให้ทำตามไฟล์นี้ Superpowers ทำหน้าที่ "วินัย" ส่วน skill ของทีม (ใน `.claude/skills/`)เป็นตัวกำหนด "รูปแบบงาน"

| Superpowers skill | ใช้ในทีมแบบนี้ |
|---|---|
| `brainstorming` | ใช้ถามคำถามและหาเคสในขั้นที่ 1 ของ `feature-workflow` แต่**ผลลัพธ์เขียนลง `docs/usecases/UC-xx-<name>.md`** (ตาราง AC แบบ Given/When/Then) ไม่ใช่ `docs/superpowers/specs/` ห้ามข้ามไปขั้นที่ 2 ก่อนผู้ใช้รีวิว AC |
| `writing-plans` | ใช้ในขั้นที่ 4 แผนบันทึกที่ `docs/plans/<ISSUE-KEY>-<ชื่อสั้น>.md` แบ่ง task **ต่อ AC** เรียงตามชั้น DDD (domain → application → infrastructure → interface/http) ทุก task ระบุรหัส AC และ commit message เป็น `<KEY> AC<n>: ...` ไม่ใช้ `feat: ...` |
| `test-driven-development` | ใช้ในขั้นที่ 5 ตามปกติ เพิ่มกติกาทีม: ชื่อเทสต์ `AC<n>: ...`, repository เทสต์กับ DB จริง, service ใช้ fake repository + `fixedClock` |
| `using-git-worktrees` | ใช้ได้ แต่ชื่อ branch ต้องเป็น `feature/<KEY>-<ชื่อสั้น>` (หรือ `fix/` `chore/` `spike/` `hotfix/`) แตกจาก `origin/main` ล่าสุด |
| `subagent-driven-development` / `executing-plans` | ใช้ได้ subagent ทุกตัวต้องได้รับกติกาจากไฟล์นี้และ skill `ddd-architecture` ไปด้วย |
| `requesting-code-review` | ให้ reviewer ตรวจ Definition of Done ของ `feature-workflow` และเช็กลิสต์ของ `ddd-architecture` เพิ่มจากที่ skill ตรวจอยู่แล้ว |
| `verification-before-completion` | ใช้คู่กับ Definition of Done รายงานเป็นตาราง AC → ไฟล์เทสต์ → สถานะ |
| `systematic-debugging` | ใช้กับ Bug ได้เลย ขั้นแรกต้องเป็นเทสต์ที่ fail ซ้ำบั๊ก (ตาม `jira-backlog`) |
| `finishing-a-development-branch` | **เลือกได้แค่ "Push และเปิด PR" หรือ "เก็บไว้ก่อน"** ห้าม merge เข้า `main` บนเครื่อง ก่อน push ให้ rebase บน `origin/main` และเทสต์ผ่านทั้งหมด branch `spike/` ห้ามเปิด PR เพื่อ merge |

ลำดับเมื่อเริ่มฟีเจอร์ใหม่: `feature-workflow` เป็นตัวคุมลำดับขั้น แล้วเรียก skill ของ Superpowers ตามตารางข้างบนในแต่ละขั้น

## กติกาที่ต้องทำเสมอ
- ห้ามเขียนโค้ด production ก่อนมีเทสต์ที่ fail ด้วยเหตุผลที่ถูกต้อง (Red → Green → Refactor)
- ชื่อเทสต์ขึ้นต้นด้วยรหัส AC เช่น `it('AC3: ...')`
- ถ้างานไม่มี AC รองรับ ให้หยุดและเสนอ AC ให้ผู้ใช้รีวิวก่อน อย่าเดาเอง
- ห้ามแก้ไฟล์ migration ที่ merge แล้ว ให้สร้าง migration ใหม่
- ห้ามแก้ API ให้หลุดจาก `openapi.yaml` ถ้าต้องเปลี่ยน ให้แก้ spec ก่อนและแจ้งผู้ใช้
- API ไม่ต้องหน้าตาเหมือนตาราง: รับ/ตอบตามสิ่งที่ผู้ใช้เห็น แล้วแปลงในโค้ด
- เทสต์ repository รันกับ database จริง (Docker/Testcontainers) ไม่ mock
- ใช้ clock ที่ inject ได้ ห้ามเรียก `new Date()` ตรงๆ ใน business logic
- กฎทางธุรกิจที่บังคับได้ที่ DB (NOT NULL, UNIQUE, CHECK, FK) ให้ใส่ใน schema ด้วย

## สถาปัตยกรรม (DDD)
อ่าน `.claude/skills/ddd-architecture/SKILL.md` ทุกครั้งที่สร้างหรือย้ายไฟล์ใน `src/modules/` และอ่าน `docs/architecture/context-map.md` ก่อน
- โค้ดแบ่งเป็น `src/modules/<context>/{domain,application,infrastructure,interface/http}`
- domain ไม่ import อะไรจากชั้นอื่น (ห้าม `pg`, `express`, ORM)
- กฎธุรกิจอยู่ใน domain เท่านั้น use case แค่โหลด → เรียก domain → บันทึก
- context อื่นใช้ได้เฉพาะสิ่งที่ `index.ts` export หรือผ่าน `ports.ts`
- เปลี่ยนข้อมูลผ่าน aggregate root เสมอ (`borrower.borrow()` ไม่ใช่ `Loan.start()` จาก use case)
- ชื่อในโค้ดตรงกับคำศัพท์ใน `context-map.md`
- ห้ามสร้าง context ใหม่หรือเปลี่ยนระดับ DDD ของ context โดยไม่ถามผู้ใช้

## Git และ Jira
อ่าน `.claude/skills/jira-backlog/SKILL.md` เมื่อร่างหรือแก้ Epic, Story, Sub-task หรือทำ CSV สำหรับ Jira
- `main` พร้อม deploy เสมอ ห้าม commit หรือ push ตรงเข้า main
- branch: `feature/` `fix/` `chore/` `spike/` `hotfix/` + `<ISSUE-KEY>-<ชื่อสั้น>` เช่น `feature/LIB-12-borrow-book`
- ใช้ key ของ Story ไม่ใช่ Sub-task; commit: `LIB-12 AC3: ...`
- ก่อนเปิด PR ให้ rebase บน `origin/main` และเทสต์ผ่านทั้งหมด
- ชื่อไฟล์ migration ใช้ timestamp (`YYYYMMDD_HHMM_<name>.sql`) กันชนกับ branch อื่น
- branch `spike/` ห้าม merge

## ความปลอดภัยของ environment
- ห้ามรันเทสต์ migration หรือ seed กับ production
- ใช้ `docker compose up` สำหรับ DB และ mock บนเครื่อง

## คำสั่ง (แก้ให้ตรงกับโปรเจกต์)
- `npm test` รันเทสต์ทั้งหมด
- `npm run migrate` / `npm run seed`
- `npx @stoplight/prism-cli mock openapi.yaml` เปิด mock server
