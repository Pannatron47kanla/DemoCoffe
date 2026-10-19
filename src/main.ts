import { createApp } from './app';
import { systemClock } from './shared/clock';
import { createPool } from './shared/db';
import { randomIds } from './shared/ids';

const {
  DATABASE_URL = 'postgres://democoffe:democoffe@127.0.0.1:5432/democoffe',
  MENU_PATH = 'data/menu.json',
  HOST = '127.0.0.1', // เฟส 1 ไม่มีคีย์ตู้ รับเฉพาะเครื่องเดียวกัน
  PORT = '3000',
} = process.env;

const app = await createApp({ pool: createPool(DATABASE_URL), menuPath: MENU_PATH, clock: systemClock, ids: randomIds });
app.listen(Number(PORT), HOST, () => console.log(`api listening on http://${HOST}:${PORT}`));
