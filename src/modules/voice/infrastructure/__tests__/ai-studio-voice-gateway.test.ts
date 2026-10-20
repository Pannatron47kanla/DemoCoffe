import { Modality } from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOICE_FUNCTION_NAMES } from '../../domain/voice-function-call';
import { AiStudioVoiceGateway, type AuthTokens } from '../ai-studio-voice-gateway';

interface SentConfig {
  uses: number;
  newSessionExpireTime: string;
  expireTime: string;
  httpOptions: { apiVersion: string };
  liveConnectConstraints: {
    model: string;
    config: {
      responseModalities: string[];
      sessionResumption: object;
      systemInstruction: string;
      tools: Array<{ functionDeclarations: Array<{ name: string; parameters: { required?: string[]; properties: Record<string, { type: string }> } }> }>;
      speechConfig: { languageCode: string };
    };
  };
}

const NOW = new Date('2026-10-20T02:30:00Z');
const SETUP = { systemInstruction: 'คำสั่งระบบทดสอบ' };

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
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC12: ล็อกรุ่น gemini-3.8-live ตอบเป็นเสียง เปิด session resumption', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    const { config } = calls[0]!;
    expect(config.liveConnectConstraints.model).toBe('gemini-3.8-live');
    expect(config.liveConnectConstraints.config.responseModalities).toEqual([Modality.AUDIO]);
    expect(config.liveConnectConstraints.config.sessionResumption).toEqual({});
    expect(config.httpOptions.apiVersion).toBe('v1alpha');
  });

  it('AC1: ล็อก systemInstruction, tools ทั้ง 5 และภาษา th-TH ในโทเคน', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    const { config } = calls[0]!.config.liveConnectConstraints;
    expect(config.systemInstruction).toBe(SETUP.systemInstruction);
    expect(config.tools).toHaveLength(1);
    expect(config.tools[0]!.functionDeclarations.map((d) => d.name)).toEqual([...VOICE_FUNCTION_NAMES]);
    expect(config.speechConfig.languageCode).toBe('th-TH');
  });

  it('AC1: schema ของ add_to_cart บังคับ menuItemId และ quantity', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    const add = calls[0]!.config.liveConnectConstraints.config.tools[0]!.functionDeclarations.find((d) => d.name === 'add_to_cart')!;
    expect(add.parameters.required).toEqual(['menuItemId', 'quantity']);
    expect(Object.keys(add.parameters.properties).sort()).toEqual(['menuItemId', 'optionChoiceIds', 'quantity']);
    expect(add.parameters.properties.optionChoiceIds!.type).toBe('ARRAY');
    expect(add.parameters.properties.quantity!.type).toBe('INTEGER');
  });

  it('AC12: ใช้ได้ 1 ครั้ง เริ่มภายใน 1 นาที อายุ 15 นาที', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    const { config } = calls[0]!;
    expect(config.uses).toBe(1);
    expect(config.newSessionExpireTime).toBe('2026-10-20T02:31:00.000Z');
    expect(config.expireTime).toBe('2026-10-20T02:45:00.000Z');
  });

  it('AC12: ไม่มีข้อมูลบุคคลในคำขอ', async () => {
    const { tokens, calls } = recordingTokens();
    await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    // ตัด systemInstruction กับ tools ออก: ชื่อฟังก์ชัน add_to_cart และคีย์ "name" ของ declaration ไม่ใช่ข้อมูลบุคคล
    const sent = calls[0]!.config;
    const { systemInstruction: _s, tools: _t, ...rest } = sent.liveConnectConstraints.config;
    const json = JSON.stringify({ ...calls[0], config: { ...sent, liveConnectConstraints: { ...sent.liveConnectConstraints, config: rest } } });
    for (const word of ['cart', 'kiosk', 'phone', 'name":', 'image']) expect(json).not.toContain(word);
  });

  it('AC12: คืน token, model และ startBefore', async () => {
    const { tokens } = recordingTokens({ name: 'auth_tokens/abc' });
    const connection = await new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);

    expect(connection).toEqual({
      token: 'auth_tokens/abc',
      model: 'gemini-3.8-live',
      startBefore: new Date('2026-10-20T02:31:00Z'),
    });
  });

  it('AC11: Google ตอบ 429 → VOICE_UNAVAILABLE', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tokens: AuthTokens = {
      create: () => Promise.reject(Object.assign(new Error('Too Many Requests'), { status: 429 })),
    };

    await expect(new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP))
      .rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
  });

  it('AC11: เกิน 3 วินาที → VOICE_UNAVAILABLE', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tokens: AuthTokens = { create: () => new Promise(() => {}) };

    const result = new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP);
    const assertion = expect(result).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
    await vi.advanceTimersByTimeAsync(3000);

    await assertion;
  });

  it('AC11: Google ตอบไม่มี name → VOICE_UNAVAILABLE', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { tokens } = recordingTokens({});

    await expect(new AiStudioVoiceGateway({ tokens, model: 'gemini-3.8-live' }).issueConnection(NOW, SETUP))
      .rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
  });
});
