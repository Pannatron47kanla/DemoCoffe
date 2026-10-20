# Context map

> AI agent อ่านไฟล์นี้ก่อนสร้างหรือย้ายไฟล์ใน `src/modules/` แก้ไฟล์นี้ทุกครั้งที่เพิ่ม context ตาราง หรือคำศัพท์ใหม่
> ขอบเขตปัจจุบัน: **เฟส 1 MVP** (ตู้เดี่ยว 1 สาขา เมนูตายตัว ตะกร้า ออเดอร์ หมายเลขคิว สั่งด้วยเสียง ยังไม่รับเงินจริง ยังไม่มี tenant)
> อ้างอิง: `docs/architecture/ข้อเสนอระบบตู้คีออสก์กาแฟV2.html`

## การติดตั้ง (เฟส 1)
ทุก node รันบนเครื่องเดียวด้วย `docker compose` (ตอนนี้คือเครื่อง dev Linux ย้ายไป N100 ภายหลัง)
- `db` Postgres · `api` backend (modular monolith) และเสิร์ฟ UI ตู้เป็น static ที่ origin เดียวกัน · `mock` Prism (dev profile)
- ภายนอกมีแค่ Gemini Live: เดโมใช้ Gemini API คีย์ฟรีของ AI Studio (ผู้ทดสอบที่ยินยอมเท่านั้น) ก่อนใช้กับลูกค้าจริงต้องเปลี่ยนเป็น Vertex AI `asia-southeast1`
- ไม่มีคีย์ตู้ในเฟส 1: `api` bind ที่ `127.0.0.1` เท่านั้น

## Contexts

| Context | ระดับ | ดูแลเรื่อง | เป็นเจ้าของ |
|---|---|---|---|
| menu | crud | เมนูเครื่องดื่ม กลุ่มตัวเลือก (ขนาด ความหวาน นม) ราคา สถานะพร้อมขาย | ไฟล์ `data/menu.json` (เฟส 1 ยังไม่มีตาราง อ่านใหม่ทุกครั้ง) |
| ordering | full | ตะกร้า ยืนยันออเดอร์ ออกหมายเลขคิวรายวัน | `carts`, `cart_lines`, `orders`, `order_lines`, `queue_counters` |
| voice | light | ความยินยอมก่อนสั่งด้วยเสียง เปิดเซสชันเสียง ออกข้อมูลเชื่อมต่อ Gemini Live | `voice_sessions`; ข้อความยินยอมใน `data/voice-consent.json` |

context ของเฟสถัดไป (payment, face-identity, membership, tenancy, device) ยังไม่สร้าง ต้องถามผู้ใช้ก่อน

## คำศัพท์ (Ubiquitous Language)

| Context | คำ | ความหมาย | ในโค้ด |
|---|---|---|---|
| menu | เมนู | เครื่องดื่มหนึ่งรายการ มีราคาตั้งต้น | `MenuItem` |
| menu | กลุ่มตัวเลือก | เช่น ขนาด ความหวาน นม บอกว่าต้องเลือกหรือไม่ | `OptionGroup` |
| menu | ตัวเลือก | ค่าหนึ่งในกลุ่ม มีราคาเพิ่ม (อาจเป็น 0) | `OptionChoice` |
| ordering | เมนูที่สั่งได้ | เมนูในมุมของ ordering (ราคา ตัวเลือก สถานะ) ได้จาก menu ผ่าน `MenuLookup` | `OrderableItem` |
| ordering | ตะกร้า | รายการที่ลูกค้าเลือกระหว่างสั่ง ยังไม่ยืนยัน | `Cart` (aggregate root) |
| ordering | รายการในตะกร้า | เมนู + ตัวเลือก + จำนวน | `CartLine` |
| ordering | ออเดอร์ | ตะกร้าที่ยืนยันแล้ว ราคาถูกตรึงไว้ ณ ตอนยืนยัน | `Order` |
| ordering | รายการในออเดอร์ | สำเนารายการพร้อมชื่อและราคา ณ ตอนยืนยัน | `OrderLine` |
| ordering | หมายเลขคิว | เลขเรียงต่อวันทำการ เริ่มที่ 1 แสดงเป็นเลขล้วน | `QueueNumber` |
| ordering | ออเดอร์ของลูกค้า | ออเดอร์ในมุมของลูกค้าบนมือถือ (คิว สถานะ รายการ ยอด) ไม่มี cartId (UC-04) | `CustomerOrder` |
| ordering | ลิงก์หน้าสถานะ | `PUBLIC_BASE_URL` + `/q/?order=<orderId>` ใส่ใน QR ที่หน้าคิว (UC-04) | `statusPageUrl` |
| ordering | ตัวนับคิว | ออกเลขคิวถัดไปของวันทำการ ใน transaction เดียวกับการบันทึกออเดอร์ | `QueueNumberSequence` |
| ordering | วันทำการ | วันตามเวลา Asia/Bangkok ใช้รีเซ็ตคิว | `BusinessDay` |
| ordering | เงิน | จำนวนเงินหน่วยสตางค์ (จำนวนเต็ม) | `Money` |
| voice | เซสชันเสียง | การสั่งด้วยเสียงของตะกร้าหนึ่งใบ เก็บหลักฐานความยินยอม (เวลา ตู้ เวอร์ชันข้อความ) ไม่ผูกกับตัวบุคคล | `VoiceSession` (aggregate root) |
| voice | ข้อมูลเชื่อมต่อเสียง | ข้อมูลชั่วคราวให้ตู้เปิดเซสชัน Gemini Live ใช้เริ่มได้ภายในเวลาจำกัด | `VoiceConnection` |
| voice | ข้อความยินยอมเรื่องเสียง | ข้อความที่แสดงก่อนเริ่มพูด มีเวอร์ชัน | `VoiceConsentText` |
| voice | การเรียกฟังก์ชันเสียง | function call หนึ่งครั้งจาก Gemini (ชื่อ + args) ที่เซิร์ฟเวอร์ทำกับตะกร้าของเซสชัน | `VoiceFunctionCall` |
| voice | คำสั่งระบบของ Gemini | ข้อความที่ล็อกในโทเคน มีเมนูปัจจุบันและข้อปฏิบัติ (UC-03 R4, R5) | `buildVoiceInstructions` |

## การคุยข้าม context

| ผู้ใช้ | ต้องการ | ผ่าน |
|---|---|---|
| ordering | ราคา ตัวเลือก และสถานะพร้อมขายของเมนู | `MenuLookup` (port ใน `ordering/application/ports.ts`) ← `JsonMenuRepository` จาก `menu/index.ts` ต่อสายใน `src/app.ts` |
| voice | ตะกร้ายังเปิดและไม่หมดอายุไหม (UC-02 R5) | `CartAvailability` (port ใน `voice/application/ports.ts`) ← `CheckCartAvailability` ของ ordering ผ่าน `ordering/index.ts` (`createOrderingModule().cartAvailability`) |
| voice | ออกโทเคนชั่วคราวของ Gemini Live | `VoiceGateway` (port) ← `AiStudioVoiceGateway` ใน `voice/infrastructure` (ถ้าไม่มี key ใช้ `unavailableVoiceGateway`) เลือกด้วย `VOICE_PROVIDER`: `ai-studio` (เดโม) / `vertex` (ลูกค้าจริง) |
| voice | แก้ตะกร้าตาม function call ของ Gemini ด้วยกฎ UC-01 (UC-03 R1) | `VoiceCartOperations` (port ใน `voice/application/ports.ts`) ← use case ของ ordering ผ่าน `ordering/index.ts` |
| voice | เมนูปัจจุบันสำหรับคำสั่งระบบของ Gemini (UC-03 R4) | `VoiceMenu` (port ใน `voice/application/ports.ts`) ← `JsonMenuRepository` จาก `menu/index.ts` |
| UI ตู้ | เมนู ตะกร้า ยืนยัน หน้าสถานะบนมือถือ | Next.js static export ใน `kiosk/` เสิร์ฟโดย `api` ที่ origin เดียวกัน เรียก `GET /menu`, `/carts/*`, `GET /orders/{orderId}` (UC-04) |
| UI ตู้ | สั่งผ่านเสียง | Gemini ส่ง function call ให้ UI ตู้ UI ส่งต่อตรงๆ ที่ `POST /voice/sessions/{sessionId}/function-calls` ไม่ตีความเอง แล้วส่ง response กลับให้ Gemini (UC-03) |

## กฎตัวเลขทางธุรกิจ

| กฎ | ค่า | อยู่ที่ |
|---|---|---|
| จำนวนต่อรายการ | 1–10 แก้ว | `CartLine.MAX_QUANTITY` |
| จำนวนรวมต่อออเดอร์ | ไม่เกิน 20 แก้ว | `Cart.MAX_CUPS` |
| ตะกร้าหมดอายุเมื่อไม่มีการแก้ไข | 15 นาที | `Cart.IDLE_TIMEOUT_MINUTES` |
| หมายเลขคิว | เริ่มที่ 1 ทุกวันทำการ (Asia/Bangkok) | `QueueNumber`, `BusinessDay` |
| เริ่มเสียงหลังออกข้อมูลเชื่อมต่อ | ภายใน 60 วินาที | `VOICE_CONNECTION.START_WITHIN_SECONDS` |
| อายุโทเคน Gemini Live | 15 นาที | `VOICE_CONNECTION.TOKEN_LIFETIME_MINUTES` |
| ถามว่ายังสั่งอยู่ไหม | ไม่แตะ 2 นาที แล้วกลับหน้าต้อนรับอีก 15 วินาทีต่อมา (UC-04 R11) | UI ตู้ |
| หน้าหมายเลขคิวกลับหน้าต้อนรับ | 30 วินาที (UC-04 R12) | UI ตู้ |
| เวลารอ Google ออกโทเคน | 3000 มิลลิวินาที (เกินแล้วกลับไปสั่งด้วยการแตะ) | `VOICE_CONNECTION.ISSUE_TIMEOUT_MS` |
