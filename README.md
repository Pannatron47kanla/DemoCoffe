# DemoCoffe
ตู้สั่งเครื่องดื่มแบบจอสัมผัสที่จำลูกค้าประจำจากใบหน้าได้ โดยภาพใบหน้าไม่ออกจากตู้ และคลาวด์เก็บเฉพาะ embedding (เวกเตอร์ตัวเลข) ภายในประเทศไทย

## รันบนเครื่อง (เฟส 1)
ต้องมี Docker และ Node 26

```sh
npm install
docker compose up -d --build db api   # Postgres + API ที่ http://127.0.0.1:3000
npm run migrate                       # รัน migration ที่ยังไม่เคยรัน
npm run seed                          # ข้อมูลทดสอบตาม AC (ล้างข้อมูลเดิม)
npm run mock                          # Prism mock จาก openapi.yaml ที่ http://127.0.0.1:4010
npm test                              # unit + repository + e2e (ใช้ Testcontainers)
npm run lint && npm run typecheck
```

- เมนูอยู่ที่ `data/menu.json` แก้ราคาหรือสถานะหมดแล้วมีผลทันที
- เอกสาร: `docs/usecases/`, `docs/architecture/context-map.md`, `openapi.yaml`

