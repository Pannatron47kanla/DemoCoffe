# Backlog: UC-04 หน้าจอตู้และหน้าสถานะออเดอร์บนมือถือ

ทีมไม่ใช้ Jira: KEY = `UC-04` · branch `feature/UC-04-kiosk-screen`

**Summary:** UC-04 สั่งเครื่องดื่มผ่านหน้าจอตู้และดูคิวบนมือถือ
**Epic:** สั่งเครื่องดื่มที่ตู้ · **Component:** UI ตู้ (ใหม่), menu, ordering, voice · **Story points:** ?

ในฐานะ ลูกค้าหน้าตู้
ฉันต้องการ เลือกเครื่องดื่มด้วยการแตะหรือพูด ยืนยัน และได้หมายเลขคิวพร้อม QR
เพื่อ สั่งได้เองและดูรายการกับคิวของตัวเองบนมือถือได้

กฎทางธุรกิจ
- ตามตาราง R1–R12 ใน `docs/usecases/UC-04-kiosk-screen.md` (ตัวเลขหลัก: ถามว่ายังสั่งอยู่ไหมหลังไม่แตะ 2 นาที กลับหน้าต้อนรับอีก 15 วินาทีต่อมา, หน้าคิวกลับเองหลัง 30 วินาที, จำนวน 1–10 แก้วต่อรายการตาม UC-01)

Acceptance criteria
- AC1–AC29 ตามตารางใน `docs/usecases/UC-04-kiosk-screen.md` (ไฟล์ use case เป็นต้นฉบับเดียว ไม่คัดลอกมาเพื่อกันข้อความไม่ตรงกัน)
- error code ใหม่: `ORDER_NOT_FOUND` (404) ส่วน code อื่นใช้ของ UC-01 ถึง UC-03

นอกขอบเขต
- แจ้งเตือนเมื่อเครื่องดื่มพร้อมและสถานะจากพนักงาน (ต้องมีเว็บร้าน)
- นำ `api` ขึ้น host (ผู้ใช้ทำเอง), ชำระเงิน, ใบหน้า, สมาชิก, session resumption อัตโนมัติ

อ้างอิง
- `docs/usecases/UC-04-kiosk-screen.md`
- openapi.yaml → `GET /menu`, `GET /orders/{orderId}`, `POST /carts/{cartId}/checkout` (เพิ่ม `statusPageUrl`)

## Sub-task

Story มี 29 AC ซึ่งเกินขนาดที่แนะนำ แต่ทุกส่วนต้องอยู่ด้วยกันจึงจะเดโมได้ จึงคง Story เดียวแล้วแบ่ง PR เป็น 3 ชุด

| # | Sub-task | PR |
|---|---|---|
| 1 | Spec: เขียน use case + AC ลง `docs/usecases` (AC1–AC29) | 1 |
| 2 | Spec: เพิ่ม `GET /menu`, `GET /orders/{orderId}`, `statusPageUrl` ใน `openapi.yaml` (AC1–AC5) | 1 |
| 3 | Review: ตาราง AC ↔ API ↔ DB (ไม่มี migration ใหม่) | 1 |
| 4 | Seed: ออเดอร์ตัวอย่างสำหรับหน้าสถานะ (AC2, AC28) | 1 |
| 5 | HTTP: `GET /menu` จาก `data/menu.json` (AC1) | 1 |
| 6 | App: อ่านออเดอร์ตาม id (AC2, AC3) | 1 |
| 7 | Infra: repository อ่านออเดอร์พร้อมรายการ กับ DB จริง (AC2) | 1 |
| 8 | HTTP: `GET /orders/{orderId}` และ `statusPageUrl` ใน checkout ตาม `PUBLIC_BASE_URL` (AC2–AC5) | 1 |
| 9 | Infra: ล็อกคำบรรยายขาเข้าและขาออกในโทเคน Gemini (AC6) | 1 |
| 10 | Setup: โครง Next.js static export ใน `kiosk/` และให้ `api` เสิร์ฟ (AC7) | 2 |
| 11 | UI: หน้าต้อนรับ หน้าสั่ง หน้าต่างตัวเลือก ตะกร้า (AC8–AC12) | 2 |
| 12 | UI: หน้ายืนยัน หน้าคิวพร้อม QR และการหมดเวลา (AC23–AC27) | 2 |
| 13 | UI: หน้าสถานะบนมือถือ (AC28, AC29) | 2 |
| 14 | UI: แผ่นยินยอมและเปิด/หยุดเสียง (AC13–AC16, AC20, AC21) | 3 |
| 15 | UI: ส่งต่อ function call, เปิดหน้ายืนยัน, เสียงหลุด (AC17–AC19) | 3 |
| 16 | UI: กล่องคำบรรยาย (AC22) | 3 |
| 17 | E2E: แตะสั่ง → ยืนยัน → เปิดหน้าสถานะจาก `statusPageUrl` | 3 |

## Definition of Ready
| ข้อ | สถานะ |
|---|---|
| AC ครบรวมเคสไม่สำเร็จ และมี error code | ✅ |
| ตัวเลขในกฎชัด | ✅ |
| มีนอกขอบเขต | ✅ |
| มี component | ✅ |
| มี story points | ❌ (`?` รอทีมประเมิน) |
| ไม่มีคำถามค้าง | ✅ |
