-- UC-01 สั่งเครื่องดื่มที่ตู้ (context: ordering)
-- เมนูอยู่ใน menu.json (context: menu) จึงเก็บแค่ menu_item_id / option choice id แบบข้อความ ไม่มี FK

CREATE TABLE carts (
  id               uuid        PRIMARY KEY,
  status           text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CHECKED_OUT')),
  last_activity_at timestamptz NOT NULL,                      -- R7 หมดอายุ 15 นาทีนับจากค่านี้
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_lines (
  id                uuid        PRIMARY KEY,
  cart_id           uuid        NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  menu_item_id      text        NOT NULL,
  option_choice_ids text[]      NOT NULL DEFAULT '{}',        -- เรียงจาก domain เพื่อให้ R6 เทียบได้
  quantity          integer     NOT NULL CHECK (quantity BETWEEN 1 AND 10),          -- R4
  unit_price_satang integer     NOT NULL CHECK (unit_price_satang >= 0),            -- R3, ใช้ตรวจ R9
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, menu_item_id, option_choice_ids)                                -- R6
);

-- R10 ตัวนับคิวต่อวันทำการ: INSERT ... ON CONFLICT DO UPDATE SET last_number = last_number + 1 RETURNING
CREATE TABLE queue_counters (
  business_day date        PRIMARY KEY,
  last_number  integer     NOT NULL CHECK (last_number > 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id              uuid        PRIMARY KEY,
  cart_id         uuid        NOT NULL UNIQUE REFERENCES carts (id),               -- R8
  idempotency_key text        NOT NULL UNIQUE,                                     -- R11
  status          text        NOT NULL CHECK (status IN ('PLACED')),               -- R12
  business_day    date        NOT NULL,
  queue_number    integer     NOT NULL CHECK (queue_number > 0),
  placed_at       timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_day, queue_number)                                              -- R10
);

-- R12 snapshot ณ ตอนยืนยัน ไม่อ้างอิงเมนูปัจจุบัน ยอดรวมของออเดอร์คิดจากตารางนี้ (ไม่เก็บซ้ำใน orders)
CREATE TABLE order_lines (
  id                uuid        PRIMARY KEY,
  order_id          uuid        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  position          integer     NOT NULL CHECK (position >= 1),                      -- ลำดับแสดงผล
  menu_item_id      text        NOT NULL,
  menu_item_name    text        NOT NULL,
  options           jsonb       NOT NULL DEFAULT '[]',        -- [{ choiceId, groupName, name, priceDeltaSatang }]
  quantity          integer     NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price_satang integer     NOT NULL CHECK (unit_price_satang >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);
