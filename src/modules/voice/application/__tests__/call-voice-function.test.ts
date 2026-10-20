import { beforeEach, describe, expect, it } from 'vitest';
import { VoiceConsentText } from '../../domain/voice-consent-text';
import { VoiceSession } from '../../domain/voice-session';
import { CallVoiceFunction } from '../call-voice-function';
import { FakeVoiceCartOperations, InMemoryVoiceSessions } from './fakes';

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const CART_ID = '7d0f1a52-4b8e-4c1e-9a77-2f1d3c4b5a60';

describe('CallVoiceFunction', () => {
  let sessions: InMemoryVoiceSessions;
  let cartOperations: FakeVoiceCartOperations;
  let useCase: CallVoiceFunction;

  beforeEach(async () => {
    sessions = new InMemoryVoiceSessions();
    cartOperations = new FakeVoiceCartOperations();
    await sessions.add(VoiceSession.consent({
      id: SESSION_ID, cartId: CART_ID, kioskId: 'kiosk-1', shownVersion: 'voice-demo-v1',
      current: VoiceConsentText.of('voice-demo-v1', 'ข้อความทดสอบ'), now: new Date('2026-10-20T02:30:00Z'),
    }));
    useCase = new CallVoiceFunction({ sessions, cartOperations });
  });

  it("AC3: add_to_cart เรียก cartOperations.add ด้วย cartId ของเซสชัน", async () => {
    const result = await useCase.execute({
      sessionId: SESSION_ID,
      call: { name: 'add_to_cart', menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 },
    });

    expect(cartOperations.calls[0]).toEqual({
      op: 'add', cartId: CART_ID, args: [{ menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 }],
    });
    expect(result.action).toBe('SHOW_CART');
    expect(result.cart).toEqual({ id: CART_ID });
  });

  it("AC4: change_quantity เรียก cartOperations.changeQuantity(cartId, lineId, 4)", async () => {
    const result = await useCase.execute({ sessionId: SESSION_ID, call: { name: 'change_quantity', lineId: 'line-1', quantity: 4 } });

    expect(cartOperations.calls[0]).toEqual({ op: 'changeQuantity', cartId: CART_ID, args: ['line-1', 4] });
    expect(result.action).toBe('SHOW_CART');
    expect(result.cart).toEqual({ id: CART_ID });
  });
});
