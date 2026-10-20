-- UC-02 ยินยอมและเริ่มสั่งด้วยเสียง (context: voice)
-- R3 เก็บเฉพาะ เวลา ตู้ เวอร์ชันข้อความ และตะกร้า ห้ามเพิ่มคอลัมน์ข้อมูลบุคคลหรือเสียง (AC3)
-- โทเคนชั่วคราวไม่เก็บ ออกใหม่ทุกครั้งที่กดเสียง (R4, R6)

CREATE TABLE voice_sessions (
  id                   uuid        PRIMARY KEY,
  cart_id              uuid        NOT NULL UNIQUE REFERENCES carts (id),         -- R4, AC13 หนึ่งตะกร้าหนึ่งเซสชัน
  kiosk_id             text        NOT NULL CHECK (kiosk_id <> ''),
  consent_text_version text        NOT NULL CHECK (consent_text_version <> ''),   -- R2
  consented_at         timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
