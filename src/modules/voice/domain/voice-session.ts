import type { VoiceConsentText } from './voice-consent-text';

export interface VoiceSessionState {
  id: string;
  cartId: string;
  kioskId: string;
  consentTextVersion: string;
  consentedAt: Date;
}

// R3 เก็บเฉพาะ เวลา ตู้ เวอร์ชันข้อความ และตะกร้า
export class VoiceSession {
  private constructor(private readonly state: VoiceSessionState) {}

  // การตรวจเวอร์ชันที่ลูกค้าเห็น (AC9) เพิ่มทีหลัง
  static consent(input: { id: string; cartId: string; kioskId: string; shownVersion: string; current: VoiceConsentText; now: Date }): VoiceSession {
    return new VoiceSession({
      id: input.id,
      cartId: input.cartId,
      kioskId: input.kioskId,
      consentTextVersion: input.current.version,
      consentedAt: input.now,
    });
  }

  static restore(state: VoiceSessionState): VoiceSession {
    return new VoiceSession({ ...state });
  }

  get id() { return this.state.id; }
  get cartId() { return this.state.cartId; }
  get consentTextVersion() { return this.state.consentTextVersion; }
  get consentedAt() { return this.state.consentedAt; }

  toState(): VoiceSessionState {
    return { ...this.state };
  }
}
