import { DomainError } from '../../../shared/domain-error';
import type { VoiceGateway } from '../application/ports';
import type { VoiceConnection } from '../domain/voice-connection';

// ใช้เมื่อปิดเสียงหรือยังไม่ตั้งค่า: ไม่พร้อมเสมอ
export const unavailableVoiceGateway: VoiceGateway = {
  available: false,
  async issueConnection(): Promise<VoiceConnection> {
    throw new DomainError('VOICE_UNAVAILABLE');
  },
};
