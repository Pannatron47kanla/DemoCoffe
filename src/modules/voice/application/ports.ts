import type { VoiceConnection } from '../domain/voice-connection';
import type { VoiceConsentText } from '../domain/voice-consent-text';
import type { VoiceMenuItem } from '../domain/voice-menu';

export interface ConsentTexts {
  current(): Promise<VoiceConsentText>; // อ่านไม่ได้ → VOICE_UNAVAILABLE
}

export interface VoiceMenu {
  current(): Promise<VoiceMenuItem[]>; // เมนูปัจจุบัน อ่านใหม่ทุกครั้ง (R4)
}

export interface VoiceSetup {
  systemInstruction: string; // ล็อกไว้ในโทเคน ตู้เปลี่ยนเองไม่ได้
}

export interface VoiceGateway {
  readonly available: boolean;
  issueConnection(now: Date, setup: VoiceSetup): Promise<VoiceConnection>; // ไม่สำเร็จ → VOICE_UNAVAILABLE
}

export interface CartAvailability {
  assertOpen(cartId: string): Promise<void>; // CART_NOT_FOUND | CART_EXPIRED | CART_ALREADY_CHECKED_OUT
}
