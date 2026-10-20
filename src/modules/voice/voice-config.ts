export interface VoiceConfig {
  enabled: boolean;
  model: string;
  apiKey: string | undefined;
  kioskId: string;
  consentPath: string;
  disabledReason?: string;
}

// อ่านเฉพาะ env ที่ส่งเข้ามา ไม่แตะ process.env ไม่ทำ I/O ไม่ log; ตั้งผิด → throw
export function loadVoiceConfig(env: Record<string, string | undefined>): VoiceConfig {
  const appEnv = env.APP_ENV ?? 'development';
  const provider = env.VOICE_PROVIDER ?? 'ai-studio';
  const enabledFlag = env.VOICE_ENABLED ?? 'true';

  // AC14: เช็กก่อนทุกอย่าง แม้ไม่มี key ก็ต้องไม่เริ่ม
  if (provider === 'ai-studio' && appEnv === 'production') {
    throw new Error('ห้ามใช้ AI Studio กับ production: ตั้ง VOICE_PROVIDER เป็นผู้ให้บริการที่ผ่านการอนุมัติ');
  }
  if (provider === 'vertex') throw new Error('VOICE_PROVIDER=vertex ยังไม่รองรับ');
  if (provider !== 'ai-studio') throw new Error(`VOICE_PROVIDER ไม่ถูกต้อง: ${provider}`);
  if (enabledFlag !== 'true' && enabledFlag !== 'false') {
    throw new Error(`VOICE_ENABLED ต้องเป็น true หรือ false: ${enabledFlag}`);
  }

  const config: VoiceConfig = {
    enabled: enabledFlag === 'true',
    model: env.VOICE_MODEL ?? 'gemini-3.8-live',
    apiKey: env.GEMINI_API_KEY,
    kioskId: env.KIOSK_ID ?? 'kiosk-1',
    consentPath: env.VOICE_CONSENT_PATH ?? 'data/voice-consent.json',
  };
  if (!config.enabled) config.disabledReason = 'VOICE_ENABLED=false';
  else if (!config.apiKey) { // AC15: ไม่มี key ก็เริ่มได้ แต่ปิดเสียง สั่งด้วยการสัมผัสยังใช้ได้
    config.enabled = false;
    config.disabledReason = 'ไม่มี GEMINI_API_KEY';
  }
  return config;
}
