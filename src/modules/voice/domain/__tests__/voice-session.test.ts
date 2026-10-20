import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../shared/domain-error';
import { VoiceConsentText } from '../voice-consent-text';
import { VoiceSession } from '../voice-session';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('VoiceSession', () => {
  it('AC2: consent บันทึกเวลา ตู้ เวอร์ชัน และตะกร้า', () => {
    const session = VoiceSession.consent({
      id: id(1),
      cartId: id(2),
      kioskId: 'kiosk-1',
      shownVersion: 'voice-demo-v1',
      current: VoiceConsentText.of('voice-demo-v1', 'ข้อความทดสอบ'),
      now: new Date('2026-10-20T02:30:00Z'),
    });

    expect(session.toState()).toEqual({
      id: id(1),
      cartId: id(2),
      kioskId: 'kiosk-1',
      consentTextVersion: 'voice-demo-v1',
      consentedAt: new Date('2026-10-20T02:30:00Z'),
    });
  });

  it('AC9: ยินยอมด้วย voice-demo-v1 แต่ปัจจุบันเป็น voice-demo-v2 → CONSENT_TEXT_OUTDATED พร้อม currentVersion', () => {
    let error: unknown;
    try {
      VoiceSession.consent({
        id: id(1),
        cartId: id(2),
        kioskId: 'kiosk-1',
        shownVersion: 'voice-demo-v1',
        current: VoiceConsentText.of('voice-demo-v2', 'ข้อความใหม่'),
        now: new Date('2026-10-20T02:30:00Z'),
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('CONSENT_TEXT_OUTDATED');
    expect((error as DomainError).details).toEqual({ currentVersion: 'voice-demo-v2' });
  });
});
