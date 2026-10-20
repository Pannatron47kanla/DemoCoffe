import type { VoiceSession } from './voice-session';

export interface VoiceSessionRepository {
  findByCartId(cartId: string): Promise<VoiceSession | null>;
  /** ถ้าตะกร้ามีเซสชันอยู่แล้ว คืนของเดิมและ created=false (R4, AC13) */
  add(session: VoiceSession): Promise<{ session: VoiceSession; created: boolean }>;
}
