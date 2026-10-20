import { existsSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { createApp } from './app';
import { systemClock } from './shared/clock';
import { AiStudioVoiceGateway, loadVoiceConfig, unavailableVoiceGateway, type VoiceConfig } from './modules/voice';
import { createPool } from './shared/db';
import { randomIds } from './shared/ids';

const {
  DATABASE_URL = 'postgres://democoffe:democoffe@127.0.0.1:5432/democoffe',
  MENU_PATH = 'data/menu.json',
  HOST = '127.0.0.1', // เฟส 1 ไม่มีคีย์ตู้ รับเฉพาะเครื่องเดียวกัน
  PORT = '3000',
  PUBLIC_BASE_URL,
  KIOSK_DIR = 'kiosk/out',
} = process.env;

// AC14: ตั้ง voice ผิด (เช่น AI Studio กับ production) ต้องหยุดก่อนต่อ DB
let voiceConfig: VoiceConfig;
try {
  voiceConfig = loadVoiceConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
if (!voiceConfig.enabled) console.warn(`voice ปิดอยู่: ${voiceConfig.disabledReason}`); // ไม่ log API key

const gateway = voiceConfig.enabled && voiceConfig.apiKey
  ? new AiStudioVoiceGateway({ tokens: new GoogleGenAI({ apiKey: voiceConfig.apiKey }).authTokens, model: voiceConfig.model })
  : unavailableVoiceGateway;

const app = await createApp({
  pool: createPool(DATABASE_URL), menuPath: MENU_PATH, clock: systemClock, ids: randomIds,
  voice: { gateway, consentPath: voiceConfig.consentPath, kioskId: voiceConfig.kioskId },
  ...(existsSync(KIOSK_DIR) ? { kioskDir: KIOSK_DIR } : {}), // ไม่มี build ก็ยังรัน API ได้
  ...(PUBLIC_BASE_URL ? { publicBaseUrl: PUBLIC_BASE_URL } : {}),
});
app.listen(Number(PORT), HOST, () => console.log(`api listening on http://${HOST}:${PORT}`));
