import type { VoiceConnection } from '../domain/voice-connection';
import type { VoiceConsentText } from '../domain/voice-consent-text';

export interface ConsentTexts {
  current(): Promise<VoiceConsentText>; // อ่านไม่ได้ → VOICE_UNAVAILABLE
}

export interface VoiceGateway {
  readonly available: boolean;
  issueConnection(now: Date): Promise<VoiceConnection>; // ไม่สำเร็จ → VOICE_UNAVAILABLE
}

export interface CartAvailability {
  assertOpen(cartId: string): Promise<void>; // CART_NOT_FOUND | CART_EXPIRED | CART_ALREADY_CHECKED_OUT
}
