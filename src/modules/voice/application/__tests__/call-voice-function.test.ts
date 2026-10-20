import { beforeEach, describe, expect, it } from 'vitest';
import { VoiceConsentText } from '../../domain/voice-consent-text';
import { VoiceSession } from '../../domain/voice-session';
import { CallVoiceFunction } from '../call-voice-function';
import { VOICE_FUNCTION_NAMES, type VoiceFunctionCall } from '../../domain/voice-function-call';
import { FakeCartAvailability, FakeVoiceCartOperations, FakeVoiceGateway, InMemoryVoiceSessions } from './fakes';

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const CART_ID = '7d0f1a52-4b8e-4c1e-9a77-2f1d3c4b5a60';

describe('CallVoiceFunction', () => {
  let sessions: InMemoryVoiceSessions;
  let cartOperations: FakeVoiceCartOperations;
  let carts: FakeCartAvailability;
  let gateway: FakeVoiceGateway;
  let useCase: CallVoiceFunction;

  beforeEach(async () => {
    sessions = new InMemoryVoiceSessions();
    cartOperations = new FakeVoiceCartOperations();
    carts = new FakeCartAvailability();
    gateway = new FakeVoiceGateway();
    await sessions.add(VoiceSession.consent({
      id: SESSION_ID, cartId: CART_ID, kioskId: 'kiosk-1', shownVersion: 'voice-demo-v1',
      current: VoiceConsentText.of('voice-demo-v1', 'ข้อความทดสอบ'), now: new Date('2026-10-20T02:30:00Z'),
    }));
    useCase = new CallVoiceFunction({ sessions, cartOperations, carts, gateway });
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

  it("AC5: remove_from_cart เรียก cartOperations.remove(cartId, lineId)", async () => {
    const result = await useCase.execute({ sessionId: SESSION_ID, call: { name: 'remove_from_cart', lineId: 'line-1' } });

    expect(cartOperations.calls[0]).toEqual({ op: 'remove', cartId: CART_ID, args: ['line-1'] });
    expect(result.action).toBe('SHOW_CART');
    expect(result.cart).toEqual({ id: CART_ID });
  });

  it("AC6: view_cart เรียก cartOperations.view(cartId) เท่านั้น", async () => {
    const result = await useCase.execute({ sessionId: SESSION_ID, call: { name: 'view_cart' } });

    expect(cartOperations.calls).toEqual([{ op: 'view', cartId: CART_ID, args: [] }]);
    expect(result.action).toBe('SHOW_CART');
    expect(result.cart).toEqual({ id: CART_ID });
  });

  it("AC7: request_checkout เรียก cartOperations.readyForCheckout(cartId) และตอบ SHOW_CHECKOUT", async () => {
    const result = await useCase.execute({ sessionId: SESSION_ID, call: { name: 'request_checkout' } });

    expect(cartOperations.calls).toEqual([{ op: 'readyForCheckout', cartId: CART_ID, args: [] }]);
    expect(result.action).toBe('SHOW_CHECKOUT');
    expect(result.cart).toEqual({ id: CART_ID });
  });

  const CALLS: Record<(typeof VOICE_FUNCTION_NAMES)[number], VoiceFunctionCall> = {
    add_to_cart: { name: 'add_to_cart', menuItemId: 'latte', optionChoiceIds: [], quantity: 1 },
    change_quantity: { name: 'change_quantity', lineId: 'line-1', quantity: 2 },
    remove_from_cart: { name: 'remove_from_cart', lineId: 'line-1' },
    view_cart: { name: 'view_cart' },
    request_checkout: { name: 'request_checkout' },
  };

  // R8: ตะกร้าหมดอายุหรือยืนยันแล้ว ทุกฟังก์ชันต้องหยุดก่อนแตะตะกร้า
  it.each(VOICE_FUNCTION_NAMES.flatMap((name) => ['CART_EXPIRED', 'CART_ALREADY_CHECKED_OUT'].map((code) => [name, code] as const)))(
    'AC15: %s กับตะกร้าที่ CartAvailability ปฏิเสธ %s → ไม่เรียก cartOperations',
    async (name, code) => {
      carts.rejectWith = code;

      await expect(useCase.execute({ sessionId: SESSION_ID, call: CALLS[name] })).rejects.toMatchObject({ code });

      expect(cartOperations.calls).toEqual([]);
    },
  );

  // AC10/AC17: ปิดเสียงต้องหยุดก่อนแตะเซสชันหรือตะกร้า
  it('AC17: ปิดเสียง → VOICE_UNAVAILABLE ไม่เรียก cartOperations', async () => {
    gateway.available = false;

    await expect(useCase.execute({ sessionId: SESSION_ID, call: { name: 'view_cart' } })).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
    await expect(useCase.execute({ sessionId: 'missing', call: { name: 'view_cart' } })).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });

    expect(cartOperations.calls).toEqual([]);
  });
});
