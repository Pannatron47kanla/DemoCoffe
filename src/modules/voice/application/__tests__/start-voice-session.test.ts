import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { sequentialIds } from '../../../../shared/ids';
import { VoiceConsentText } from '../../domain/voice-consent-text';
import { StartVoiceSession } from '../start-voice-session';
import { FakeCartAvailability, FakeConsentTexts, FakeVoiceGateway, InMemoryVoiceSessions } from './fakes';

const CART_ID = '00000000-0000-4000-8000-0000000000c1';

describe('StartVoiceSession', () => {
  let sessions: InMemoryVoiceSessions;
  let consentTexts: FakeConsentTexts;
  let gateway: FakeVoiceGateway;
  let clock: ReturnType<typeof fixedClock>;
  let carts: FakeCartAvailability;
  let start: StartVoiceSession;

  beforeEach(() => {
    sessions = new InMemoryVoiceSessions();
    consentTexts = new FakeConsentTexts();
    gateway = new FakeVoiceGateway();
    clock = fixedClock('2026-10-20T02:30:00Z');
    carts = new FakeCartAvailability();
    start = new StartVoiceSession({
      sessions, carts, consentTexts, gateway, clock, ids: sequentialIds(), kioskId: 'kiosk-1',
    });
  });

  it('AC2: ตะกร้าเปิดอยู่ ยินยอมตอน 09:30 ได้เซสชันใหม่และข้อมูลเชื่อมต่อ', async () => {
    const result = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });

    expect(result.created).toBe(true);
    expect(sessions.count()).toBe(1);
    // หลักฐานความยินยอมที่เก็บ: เวลา 09:30, ตู้, เวอร์ชันข้อความ, ตะกร้า
    const stored = await sessions.findByCartId(CART_ID);
    expect(stored?.toState()).toEqual({
      id: result.session.id,
      cartId: CART_ID,
      kioskId: 'kiosk-1',
      consentTextVersion: 'voice-demo-v1',
      consentedAt: new Date('2026-10-20T02:30:00Z'),
    });
    expect(result.connection.token.startsWith('auth_tokens/')).toBe(true);
    expect(result.connection.model).toBe('gemini-3.8-live');
    expect(result.connection.startBefore).toEqual(new Date('2026-10-20T02:31:00Z'));
    expect(gateway.calls).toEqual([new Date('2026-10-20T02:30:00Z')]);
  });

  it('AC4: ตะกร้ามีเซสชันแล้ว ได้เซสชันเดิม ข้อมูลเชื่อมต่อใหม่ ไม่มีบันทึกเพิ่ม', async () => {
    const first = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });
    clock.advance(5 * 60_000);

    const second = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });

    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.consentedAt).toEqual(new Date('2026-10-20T02:30:00Z'));
    expect(second.connection.token).not.toBe(first.connection.token);
    expect(second.connection.startBefore).toEqual(new Date('2026-10-20T02:36:00Z'));
    expect(sessions.count()).toBe(1);
    expect(sessions.addCalls).toBe(1); // กดซ้ำต้องไม่พยายามบันทึกความยินยอมอีก
  });

  it('AC4: ข้อความเปลี่ยนเป็น voice-demo-v2 หลังยินยอมแล้ว กดซ้ำยังได้เซสชันเดิม', async () => {
    const first = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });
    consentTexts.text = VoiceConsentText.of('voice-demo-v2', 'ข้อความใหม่');

    const second = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });

    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.consentTextVersion).toBe('voice-demo-v1');
    expect(sessions.count()).toBe(1);
    expect(sessions.addCalls).toBe(1); // กดซ้ำต้องไม่พยายามบันทึกความยินยอมอีก
  });

  it('AC7: CartAvailability ปฏิเสธ CART_EXPIRED → ไม่มีบันทึก ไม่ขอโทเคน', async () => {
    carts.rejectWith = 'CART_EXPIRED';

    await expect(start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' })).rejects.toMatchObject({ code: 'CART_EXPIRED' });

    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC9: ยินยอมด้วย voice-demo-v1 แต่ปัจจุบันเป็น voice-demo-v2 → CONSENT_TEXT_OUTDATED ไม่มีบันทึก ไม่ขอโทเคน', async () => {
    consentTexts.text = VoiceConsentText.of('voice-demo-v2', 'ข้อความใหม่');

    await expect(start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' })).rejects.toMatchObject({
      code: 'CONSENT_TEXT_OUTDATED',
      details: { currentVersion: 'voice-demo-v2' },
    });

    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC10: ปิดเสียง → VOICE_UNAVAILABLE ไม่มีบันทึก ไม่ขอโทเคน', async () => {
    gateway.available = false;

    await expect(start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' })).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });

    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC11: ขอโทเคนไม่สำเร็จ บันทึกความยินยอมยังอยู่ กดอีกครั้งไม่ถามยินยอมซ้ำ', async () => {
    gateway.fail = true;
    await expect(start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' })).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
    expect(sessions.count()).toBe(1);

    gateway.fail = false;
    const again = await start.execute({ cartId: CART_ID, consentTextVersion: 'voice-demo-v1' });

    expect(again.created).toBe(false);
    expect(sessions.count()).toBe(1);
  });

  it('AC13: สองคำขอพร้อมกันได้ created หนึ่งครั้ง', async () => {
    const input = { cartId: CART_ID, consentTextVersion: 'voice-demo-v1' };

    const results = await Promise.all([start.execute(input), start.execute(input)]);

    expect(results.map((r) => r.created).sort()).toEqual([false, true]);
    expect(results[0].session.id).toBe(results[1].session.id);
    expect(sessions.count()).toBe(1);
  });
});
