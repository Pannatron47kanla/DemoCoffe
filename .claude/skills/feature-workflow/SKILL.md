---
name: feature-workflow
description: ใช้เมื่อเริ่มฟีเจอร์ใหม่หรือ use case ใหม่ พาทำตาม workflow ของทีม use case + AC → DB + API spec → mock/seed → TDD → integration test
---

# Feature workflow (Spec-First)

ทำทีละขั้นตามลำดับ หยุดให้ผู้ใช้รีวิวที่จุด **[REVIEW]** ก่อนไปขั้นถัดไป ห้ามข้ามไปเขียนโค้ดก่อนผ่านขั้นที่ 1–2

skill นี้เป็นตัวคุมลำดับขั้น ถ้าติดตั้ง Superpowers ไว้ ให้เรียก skill ของ Superpowers ที่ระบุในแต่ละขั้น และทำตามหัวข้อ "ลำดับความสำคัญเมื่อ skill ซ้อนกัน" กับ "ใช้ร่วมกับ Superpowers" ใน AGENTS.md ถ้าไม่ได้ติดตั้งก็ทำตามขั้นข้างล่างได้เหมือนเดิม

## ขั้นที่ 1: Use case + Acceptance criteria
(Superpowers: `brainstorming` ใช้ถามคำถามทีละข้อเพื่อหาเคสและกฎที่ยังไม่ชัด แต่เขียนผลลงไฟล์ use case ข้างล่างแทน `docs/superpowers/specs/` เมื่อ brainstorming จบให้กลับมาทำขั้นที่ 2 ต่อ ไม่ต้องเรียก `writing-plans` ตามที่ brainstorming บอก แผนรอไว้ขั้นที่ 4)

สร้าง `docs/usecases/UC-xx-<name>.md` ประกอบด้วย
- ผู้ใช้งาน, เงื่อนไขก่อนเริ่ม, ขั้นตอนหลัก, กฎทางธุรกิจ (ตัวเลขต้องชัด)
- ตาราง AC แบบ Given / When / Then มีรหัส AC1, AC2, ...
- ต้องมีเคสไม่สำเร็จ: ข้อมูลไม่ครบ, ไม่พบข้อมูล, ไม่มีสิทธิ์, ของซ้ำ, ผิดกฎแต่ละข้อ

ตัวอย่างแถว: `| AC3 | สมาชิกยืมอยู่แล้ว 3 เล่ม | ยืม | ปฏิเสธ: LOAN_LIMIT_REACHED |`

ถ้ากฎไม่ชัด ให้ถามผู้ใช้ อย่าเดา

ใช้ skill `jira-backlog` ร่าง Story และรายการ Sub-task คู่กับไฟล์ use case ให้ AC ตรงกันทั้งสองที่ ถ้ารู้ issue key แล้ว ให้แตก branch `feature/<KEY>-<ชื่อสั้น>` จาก `main` ล่าสุดก่อนเริ่มเขียนไฟล์ **[REVIEW]**

## ขั้นที่ 2: Database คู่กับ API spec
**Database**
- ดึง entity จาก use case คิดว่าต้องแยกตารางไหม (เช่น books กับ book_copies)
- เขียน migration ใหม่ใน `db/migrations/` ห้ามแก้ไฟล์เดิม
- ใส่ NOT NULL, UNIQUE, CHECK, FK ตามกฎ; ใช้ partial unique index สำหรับกฎแบบ "ทีละหนึ่ง"
- วาง index จาก query ที่ AC ต้องใช้
- ไม่เก็บข้อมูลเดียวกันสองที่; มี created_at / updated_at

**API spec**
- เพิ่ม endpoint ใน `openapi.yaml` พร้อม `example` ทุก field
- ทุก error มี `code` ที่ตรงกับ AC (404 ไม่พบ, 409 ผิดกฎ, 400 ข้อมูลผิดรูปแบบ)
- API รับ/ตอบตามสิ่งที่ผู้ใช้เห็น ไม่ต้องตรงกับตาราง

**ตรวจ**: ทำตาราง `AC | API ตอบ | DB ช่วยกันไว้` ทุก AC ต้องมีที่อยู่ **[REVIEW]**

## ขั้นที่ 3: Mock + seed
- ยืนยันว่า `npx @stoplight/prism-cli mock openapi.yaml` เปิดได้
- เพิ่ม seed ใน `db/seed.sql` ให้มีข้อมูลหนึ่งชุดต่อ AC และบอกว่าชุดไหนใช้กับ AC ไหน

## ขั้นที่ 4: แผนงาน
สรุปงานแบบแนวตั้ง (route → service → repository → เทสต์) ต่อ use case ถ้าผู้ใช้ต้องแบ่งให้หลายคน

(Superpowers: `writing-plans` บันทึกที่ `docs/plans/<ISSUE-KEY>-<ชื่อสั้น>.md` หนึ่ง task ต่อ AC เรียงจากในออกนอกตามชั้น DDD ใส่รหัส AC และ commit message แบบ `<KEY> AC<n>: ...` ในทุก task) **[REVIEW]**

## ขั้นที่ 5: TDD ทีละ AC
(Superpowers: `using-git-worktrees` ถ้าต้องการแยก workspace ใช้ worktree แบบ native ชื่อ branch ตามกติกาทีม แล้วใช้ `subagent-driven-development` หรือ `executing-plans` ทำตามแผน และ `test-driven-development` ในทุก task subagent ต้องได้กติกาจาก AGENTS.md และ `ddd-architecture` ไปด้วย)

โหลด skill `ddd-architecture` ก่อนเขียนโค้ด เพื่อวางไฟล์ให้ถูก context และถูกชั้น และสร้างจากในออกนอก (domain → application → infrastructure → interface/http)

วนต่อ AC ทีละข้อ:
1. **Red**: เขียนเทสต์ชื่อ `AC<n>: ...` รันแล้วยืนยันว่า fail ด้วยเหตุผลที่ถูกต้อง (แสดงผลรันให้ผู้ใช้เห็น)
2. **Green**: เขียนโค้ดน้อยที่สุดให้ผ่าน รันเทสต์ทั้งหมด
3. **Refactor**: ปรับโค้ดเมื่อมีซ้ำซ้อน เทสต์ต้องยังผ่าน

ชั้นของเทสต์:
- Service: fake repository + clock ที่กำหนดเวลาได้
- Repository: database จริง (Docker/Testcontainers) รวมเทสต์ constraint เช่นยืมซ้อน
- Route: HTTP + ตรวจ response ตาม spec

ถ้าเผลอเขียนโค้ดก่อนเทสต์ ให้ลบโค้ดนั้นแล้วเริ่มรอบใหม่

## ขั้นที่ 6: Integration + CI
- เพิ่ม E2E ที่ข้าม use case อย่างน้อยหนึ่ง flow
- ตรวจว่า CI รัน migrate จากศูนย์ → seed → test

## Definition of Done (ตรวจก่อนบอกว่าเสร็จ)
(Superpowers: `verification-before-completion` รันคำสั่งตรวจจริงทุกข้อ แล้ว `requesting-code-review` ให้ reviewer ตรวจรายการนี้และเช็กลิสต์ของ `ddd-architecture` สุดท้าย `finishing-a-development-branch` เลือกได้แค่เปิด PR หรือเก็บไว้ ห้าม merge เข้า main บนเครื่อง)

- [ ] AC ทุกข้อมีเทสต์ ชื่อขึ้นต้นด้วยรหัส AC
- [ ] repository มีเทสต์กับ DB จริง
- [ ] response ตรง `openapi.yaml`
- [ ] migration รันจากศูนย์ผ่าน ไม่มีการแก้ไฟล์เดิม
- [ ] seed ครบสำหรับ AC ใหม่
- [ ] เทสต์ทั้งหมดผ่าน

รายงานผู้ใช้เป็นตาราง AC → ไฟล์เทสต์ → สถานะ
