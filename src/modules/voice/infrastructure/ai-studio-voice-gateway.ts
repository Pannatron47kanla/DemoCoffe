import { Modality, type CreateAuthTokenParameters } from '@google/genai';
import { DomainError } from '../../../shared/domain-error';
import type { VoiceGateway, VoiceSetup } from '../application/ports';
import { VOICE_CONNECTION, type VoiceConnection } from '../domain/voice-connection';
import { VOICE_FUNCTION_DECLARATIONS } from './voice-function-declarations';

// รูปเดียวกับ GoogleGenAI#authTokens
export interface AuthTokens {
  create(params: CreateAuthTokenParameters): Promise<{ name?: string }>;
}

// ขอโทเคนชั่วคราวของ Gemini Live (AI Studio) ใช้ครั้งเดียว เสียงอย่างเดียว (AC12)
export class AiStudioVoiceGateway implements VoiceGateway {
  readonly available = true as const;

  constructor(private readonly deps: { tokens: AuthTokens; model: string }) {}

  async issueConnection(now: Date, setup: VoiceSetup): Promise<VoiceConnection> {
    const startBefore = new Date(now.getTime() + VOICE_CONNECTION.START_WITHIN_SECONDS * 1000);
    const expireTime = new Date(now.getTime() + VOICE_CONNECTION.TOKEN_LIFETIME_MINUTES * 60_000);
    const created = await this.requestToken({
      config: {
        uses: 1,
        newSessionExpireTime: startBefore.toISOString(),
        expireTime: expireTime.toISOString(),
        // ล็อกรุ่น เมนู ฟังก์ชัน ภาษา และรูปแบบการตอบ ตู้เปลี่ยนเองไม่ได้ ไม่ส่งข้อมูลบุคคลไปกับคำขอ
        liveConnectConstraints: {
          model: this.deps.model,
          config: {
            responseModalities: [Modality.AUDIO],
            sessionResumption: {},
            systemInstruction: setup.systemInstruction,
            tools: [{ functionDeclarations: VOICE_FUNCTION_DECLARATIONS }],
            speechConfig: { languageCode: 'th-TH' },
          },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    return { token: created, model: this.deps.model, startBefore };
  }

  // ขอโทเคนภายใน ISSUE_TIMEOUT_MS ทุกความล้มเหลวกลายเป็น VOICE_UNAVAILABLE (AC11)
  private async requestToken(params: CreateAuthTokenParameters): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('token request timed out')), VOICE_CONNECTION.ISSUE_TIMEOUT_MS);
    });
    try {
      const created = await Promise.race([this.deps.tokens.create(params), timeout]);
      if (typeof created.name !== 'string' || created.name === '') throw new Error('token response has no name');
      return created.name;
    } catch (error) {
      // log เฉพาะ status/ข้อความ ห้ามมี API key
      const status = (error as { status?: unknown }).status;
      console.warn('voice token request failed:', status ?? (error instanceof Error ? error.message : 'unknown'));
      throw new DomainError('VOICE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }
}
