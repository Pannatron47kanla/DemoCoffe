import { DomainError } from '../../../shared/domain-error';
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

  // R2 ยินยอมได้เฉพาะเวอร์ชันข้อความปัจจุบัน (AC9)
  static consent(input: { id: string; cartId: string; kioskId: string; shownVersion: string; current: VoiceConsentText; now: Date }): VoiceSession {
    if (input.shownVersion !== input.current.version) {
      throw new DomainError('CONSENT_TEXT_OUTDATED', { currentVersion: input.current.version });
    }
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
