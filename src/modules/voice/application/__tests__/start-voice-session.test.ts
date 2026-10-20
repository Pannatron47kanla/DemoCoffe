import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { sequentialIds } from '../../../../shared/ids';
import { StartVoiceSession } from '../start-voice-session';
import { FakeCartAvailability, FakeConsentTexts, FakeVoiceGateway, InMemoryVoiceSessions } from './fakes';

const CART_ID = '00000000-0000-4000-8000-0000000000c1';

describe('StartVoiceSession', () => {
  let sessions: InMemoryVoiceSessions;
  let gateway: FakeVoiceGateway;
  let clock: ReturnType<typeof fixedClock>;
  let start: StartVoiceSession;

  beforeEach(() => {
    sessions = new InMemoryVoiceSessions();
    gateway = new FakeVoiceGateway();
    clock = fixedClock('2026-10-20T02:30:00Z');
    start = new StartVoiceSession({
      sessions, carts: new FakeCartAvailability(), consentTexts: new FakeConsentTexts(), gateway, clock, ids: sequentialIds(), kioskId: 'kiosk-1',
    });
  });

  it('AC2: ตะกร้าเปิดอยู่ ยินยอมตอน 09:30 ได้เซสชันใหม่และข้อมูลเชื่อมต่อ', async () => {
    const result = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });

    expect(result.created).toBe(true);
    expect(sessions.count()).toBe(1);
    expect(result.connection.token.startsWith('auth_tokens/')).toBe(true);
    expect(result.connection.model).toBe('gemini-3.8-live');
    expect(result.connection.startBefore).toEqual(new Date('2026-10-20T02:31:00Z'));
    expect(gateway.calls).toEqual([new Date('2026-10-20T02:30:00Z')]);
  });
});
