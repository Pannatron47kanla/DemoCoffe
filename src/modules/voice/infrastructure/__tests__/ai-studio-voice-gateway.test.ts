import { Modality } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { AiStudioVoiceGateway, type AuthTokens } from '../ai-studio-voice-gateway';

interface SentConfig {
  uses: number;
  newSessionExpireTime: string;
  expireTime: string;
  httpOptions: { apiVersion: string };
  liveConnectConstraints: { model: string; config: { responseModalities: string[]; sessionResumption: object } };
}

const NOW = new Date('2026-10-20T02:30:00Z');

// AuthTokens ปลอมที่จดพารามิเตอร์ไว้ตรวจ
function recordingTokens(reply: { name?: string } = { name: 'auth_tokens/abc' }) {
  const calls: Array<{ config: SentConfig }> = [];
  const tokens: AuthTokens = {
    async create(params) {
      calls.push(params as unknown as { config: SentConfig });
      return reply;
    },
  };
  return { tokens, calls };
}

describe('AiStudioVoiceGateway', () => {
  it('AC12: ล็อกรุ่น gemini-3.8-live ตอบเป็นเสียง เปิด session resumption', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW);

    const { config } = calls[0]!;
    expect(config.liveConnectConstraints.model).toBe('gemini-3.8-live');
    expect(config.liveConnectConstraints.config.responseModalities).toEqual([Modality.AUDIO]);
    expect(config.liveConnectConstraints.config.sessionResumption).toEqual({});
    expect(config.httpOptions.apiVersion).toBe('v1alpha');
  });

  it('AC12: ใช้ได้ 1 ครั้ง เริ่มภายใน 1 นาที อายุ 15 นาที', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW);

    const { config } = calls[0]!;
    expect(config.uses).toBe(1);
    expect(config.newSessionExpireTime).toBe('2026-10-20T02:31:00.000Z');
    expect(config.expireTime).toBe('2026-10-20T02:45:00.000Z');
  });

  it('AC12: ไม่มีข้อมูลบุคคลในคำขอ', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW);

    const json = JSON.stringify(calls[0]);
    for (const word of ['cart', 'kiosk', 'phone', 'name":', 'image']) expect(json).not.toContain(word);
  });

  it('AC12: คืน token, model และ startBefore', async () => {
    const { tokens } = recordingTokens({ name: 'auth_tokens/abc' });
    const connection = await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW);

    expect(connection).toEqual({
      token: 'auth_tokens/abc',
      model: 'gemini-3.8-live',
      startBefore: new Date('2026-10-20T02:31:00Z'),
    });
  });
});
