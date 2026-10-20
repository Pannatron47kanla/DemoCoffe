import { describe, expect, it } from 'vitest';
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
});
