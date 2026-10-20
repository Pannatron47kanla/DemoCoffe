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

export type CartSnapshot = Record<string, unknown>; // JSON ตาม schema Cart ที่ ordering map ให้ voice ไม่ตีความ

export interface VoiceCartOperations {
  add(cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }): Promise<CartSnapshot>;
  changeQuantity(cartId: string, lineId: string, quantity: number): Promise<CartSnapshot>;
  remove(cartId: string, lineId: string): Promise<CartSnapshot>;
  view(cartId: string): Promise<CartSnapshot>;
  readyForCheckout(cartId: string): Promise<CartSnapshot>; // CART_EMPTY ถ้าว่าง ไม่ยืนยัน
}

export interface CartAvailability {
  assertOpen(cartId: string): Promise<void>; // CART_NOT_FOUND | CART_EXPIRED | CART_ALREADY_CHECKED_OUT
}
