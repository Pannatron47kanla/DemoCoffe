-- ข้อมูลทดสอบ UC-01 หนึ่งชุดต่อ AC (เมนูอยู่ใน data/menu.json)
-- เวลาอิง now() เพื่อให้ตะกร้าเปิดยังไม่หมดอายุตอนลองเล่น; วันทำการ = วันที่ Asia/Bangkok
-- id ขึ้นต้น: c = cart, a = cart line, e = order, b = order line; เลขท้าย = ชุด S<n>

TRUNCATE voice_sessions, order_lines, orders, cart_lines, carts, queue_counters;

-- S1 ตะกร้าว่าง → AC1, AC2, AC6, AC7, AC8 (matcha-latte), AC9, AC10 (latte + whip-cream), AC20
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'OPEN', now());

-- S2 ลาเต้ L นมโอ๊ต 2 แก้ว → AC3, AC4, AC5, AC11 (เพิ่มอีก 9 = 11)
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000002', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'latte', '{milk-oat,size-l}', 2, 8000);

-- S3 ตะกร้า 18 แก้ว → AC12 (เพิ่มอีก 3 = 21)
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000003', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000003', 'latte', '{size-m}', 10, 5500),
  ('a0000000-0000-4000-8000-000000000032', 'c0000000-0000-4000-8000-000000000003', 'americano', '{size-m}', 8, 5000);

-- S4 ตะกร้าไม่ได้แก้ไข 16 นาที → AC14
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000004', 'OPEN', now() - interval '16 minutes');
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'espresso', '{}', 1, 4500);

-- S5 ตะกร้ายืนยันแล้วด้วย key k-123 คิว 1 ของวันนี้ → AC18, AC19, AC25 (k-123 กับ S6)
--    snapshot ชื่อและราคาเดิมต่างจากเมนูปัจจุบัน → AC24
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000005', 'CHECKED_OUT', now() - interval '5 minutes');
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'latte', '{milk-oat,size-l}', 2, 7500);
INSERT INTO orders (id, cart_id, idempotency_key, status, business_day, queue_number, placed_at) VALUES
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'k-123', 'PLACED',
   (now() AT TIME ZONE 'Asia/Bangkok')::date, 1, now() - interval '5 minutes');
INSERT INTO order_lines (id, order_id, position, menu_item_id, menu_item_name, options, quantity, unit_price_satang) VALUES
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005', 1, 'latte', 'ลาเต้ (สูตรเดิม)',
   '[{"choiceId":"size-l","groupName":"ขนาด","name":"L","priceDeltaSatang":1000},{"choiceId":"milk-oat","groupName":"นม","name":"นมโอ๊ต","priceDeltaSatang":1000}]',
   2, 7500);

-- S6, S7 ตะกร้าพร้อมยืนยัน → AC16 (ได้คิว 42), AC23 (ยืนยัน S6 กับ S7 พร้อมกัน)
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000006', 'OPEN', now()),
  ('c0000000-0000-4000-8000-000000000007', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000006', 'latte', '{size-m}', 2, 5500),
  ('a0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000007', 'americano', '{size-m}', 1, 5000);

-- S8 ตะกร้ามีมัทฉะลาเต้ซึ่งตอนนี้หมด → AC21
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000008', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000008', 'matcha-latte', '{size-m}', 1, 6500);

-- S9 ลาเต้ใส่ตะกร้าตอน 50 บาท เมนูตอนนี้ 55 → AC22
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000009', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'latte', '{size-m}', 2, 5000);

-- ตัวนับคิว: วันนี้ออกไปแล้ว 41 ใบ → AC16; เมื่อวานจบที่ 87 → AC17 (วันนี้ต้องไม่ต่อจาก 87)
-- AC15 (คิว 1 ของวันที่ยังไม่มีออเดอร์) ใช้วันที่ไม่มีแถวในตาราง เช่นในเทสต์ที่ fix clock
INSERT INTO queue_counters (business_day, last_number) VALUES
  ((now() AT TIME ZONE 'Asia/Bangkok')::date, 41),
  ((now() AT TIME ZONE 'Asia/Bangkok')::date - 1, 87);

-- UC-02 สั่งด้วยเสียง (ข้อความยินยอมอยู่ใน data/voice-consent.json เวอร์ชัน voice-demo-v1)
-- id ขึ้นต้น: d = voice session; เลขท้าย 2x = ชุด V<n> ของ UC-02
-- AC6 ใช้ cartId ที่ไม่มีในตาราง, AC7 ใช้ S4 (ไม่ได้แก้ไข 16 นาที), AC8 ใช้ S5 (ยืนยันแล้ว)
-- AC9 แก้ data/voice-consent.json เป็น voice-demo-v2 แล้วยินยอมด้วย voice-demo-v1 กับ V1
-- AC10, AC14, AC15 ตั้งค่าที่ env ของ api; AC12 ตรวจในเทสต์ของ adapter

-- V1 ตะกร้าเปิด ยังไม่มีเซสชันเสียง → AC2, AC5, AC9, AC10, AC11, AC13
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000021', 'OPEN', now());
INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang) VALUES
  ('a0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000021', 'latte', '{size-m}', 1, 5500);

-- V2 ตะกร้าเปิดที่ยินยอมแล้วเมื่อ 2 นาทีก่อน → AC3, AC4
INSERT INTO carts (id, status, last_activity_at) VALUES
  ('c0000000-0000-4000-8000-000000000022', 'OPEN', now());
INSERT INTO voice_sessions (id, cart_id, kiosk_id, consent_text_version, consented_at) VALUES
  ('d0000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000022', 'kiosk-1', 'voice-demo-v1', now() - interval '2 minutes');
