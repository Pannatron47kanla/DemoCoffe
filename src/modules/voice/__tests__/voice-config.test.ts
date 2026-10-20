import { describe, expect, it } from 'vitest';
import { loadVoiceConfig } from '../voice-config';

describe('loadVoiceConfig', () => {
  it('AC14: APP_ENV=production กับ VOICE_PROVIDER=ai-studio → throw ห้ามใช้ AI Studio กับ production', () => {
    expect(() => loadVoiceConfig({ APP_ENV: 'production', VOICE_PROVIDER: 'ai-studio', GEMINI_API_KEY: 'k' }))
      .toThrow('ห้ามใช้ AI Studio กับ production');
  });

  it('AC14: APP_ENV=production โดยไม่ตั้ง VOICE_PROVIDER → throw', () => {
    expect(() => loadVoiceConfig({ APP_ENV: 'production', GEMINI_API_KEY: 'k' }))
      .toThrow('ห้ามใช้ AI Studio กับ production');
  });

  it('AC14: production + ai-studio + ไม่มี key → ยัง throw (เช็ก AC14 ก่อน key)', () => {
    expect(() => loadVoiceConfig({ APP_ENV: 'production', VOICE_PROVIDER: 'ai-studio' }))
      .toThrow('ห้ามใช้ AI Studio กับ production');
  });

  it('AC14: VOICE_PROVIDER=vertex → throw ยังไม่รองรับ', () => {
    expect(() => loadVoiceConfig({ VOICE_PROVIDER: 'vertex' })).toThrow('ยังไม่รองรับ');
  });

  it('AC14: VOICE_PROVIDER ค่าอื่น → throw', () => {
    expect(() => loadVoiceConfig({ VOICE_PROVIDER: 'foo' })).toThrow();
  });

  it('AC14: VOICE_ENABLED ที่ไม่ใช่ true/false → throw', () => {
    expect(() => loadVoiceConfig({ VOICE_ENABLED: 'yes', GEMINI_API_KEY: 'k' })).toThrow();
  });

  it('AC14: development + ai-studio + มี key → enabled', () => {
    expect(loadVoiceConfig({ APP_ENV: 'development', VOICE_PROVIDER: 'ai-studio', GEMINI_API_KEY: 'k' }))
      .toMatchObject({ enabled: true, model: 'gemini-3.8-live', kioskId: 'kiosk-1', apiKey: 'k', consentPath: 'data/voice-consent.json' });
  });

  it('AC10: VOICE_ENABLED=false → enabled false', () => {
    const config = loadVoiceConfig({ VOICE_ENABLED: 'false', GEMINI_API_KEY: 'k' });
    expect(config.enabled).toBe(false);
    expect(config.disabledReason).toBeTruthy();
  });
});
