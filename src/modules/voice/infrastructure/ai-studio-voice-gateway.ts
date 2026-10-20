import { Modality } from '@google/genai';
import type { VoiceGateway } from '../application/ports';
import { VOICE_CONNECTION, type VoiceConnection } from '../domain/voice-connection';

// รูปเดียวกับ GoogleGenAI#authTokens
export interface AuthTokens {
  create(params: { config: Record<string, unknown> }): Promise<{ name?: string }>;
}

// ขอโทเคนชั่วคราวของ Gemini Live (AI Studio) ใช้ครั้งเดียว เสียงอย่างเดียว (AC12)
export class AiStudioVoiceGateway implements VoiceGateway {
  readonly available = true as const;

  constructor(private readonly deps: { tokens: AuthTokens; model: string }) {}

  async issueConnection(now: Date): Promise<VoiceConnection> {
    const startBefore = new Date(now.getTime() + VOICE_CONNECTION.START_WITHIN_SECONDS * 1000);
    const expireTime = new Date(now.getTime() + VOICE_CONNECTION.TOKEN_LIFETIME_MINUTES * 60_000);
    const created = await this.deps.tokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: startBefore.toISOString(),
        expireTime: expireTime.toISOString(),
        // ล็อกรุ่นและรูปแบบการตอบ ตู้เปลี่ยนเองไม่ได้ ไม่ส่งข้อมูลบุคคลไปกับคำขอ
        liveConnectConstraints: {
          model: this.deps.model,
          config: { responseModalities: [Modality.AUDIO], sessionResumption: {} },
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    return { token: created.name as string, model: this.deps.model, startBefore };
  }
}
