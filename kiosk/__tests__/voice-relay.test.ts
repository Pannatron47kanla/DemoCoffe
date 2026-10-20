import { describe, expect, it } from 'vitest';
import { relayFunctionCalls } from '../lib/voice-relay';
import type { Cart } from '../lib/types';
import { fakeApi } from './support/fake-api';

const cart = { id: 'c1', status: 'OPEN', lines: [], totalCups: 0, total: { amount: '0.00', currency: 'THB' } } as unknown as Cart;

describe('UC-04 relayFunctionCalls', () => {
  it('AC17: ส่งหลาย call ตามลำดับและตอบครบทุก id', async () => {
    const api = fakeApi({
      callVoiceFunction: async (_s, call) => ({ status: 200, body: { action: call.name === 'request_checkout' ? 'SHOW_CHECKOUT' : 'SHOW_CART', cart } }),
    });
    const result = await relayFunctionCalls(api, 'vs-1', [
      { id: 'a', name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 1 } },
      { id: 'b', name: 'view_cart', args: {} },
      { id: 'c', name: 'request_checkout', args: {} },
    ]);

    expect(api.calls.callVoiceFunction.map((c) => [c[0], (c[1] as { name: string }).name])).toEqual([
      ['vs-1', 'add_to_cart'], ['vs-1', 'view_cart'], ['vs-1', 'request_checkout'],
    ]);
    expect(result.responses.map((r) => [r.id, r.name])).toEqual([['a', 'add_to_cart'], ['b', 'view_cart'], ['c', 'request_checkout']]);
    expect(result.fatal).toBe(false);
    expect(result.showCheckout).toBe(true);
    expect(result.cart).toEqual(cart);
  });

  it('AC17: 409 CART_EXPIRED ส่ง body ให้ Gemini ไม่ fatal', async () => {
    const body = { code: 'CART_EXPIRED', message: 'ตะกร้าหมดอายุ' };
    const api = fakeApi({ callVoiceFunction: async () => ({ status: 409, body }) });
    const result = await relayFunctionCalls(api, 'vs-1', [{ id: 'a', name: 'view_cart', args: {} }]);
    expect(result).toEqual({ responses: [{ id: 'a', name: 'view_cart', response: body }], showCheckout: false, fatal: false });
  });

  it('AC17: 404 และ 400 ส่ง body ให้ Gemini', async () => {
    const bodies: Record<string, unknown> = { a: { code: 'MENU_ITEM_NOT_FOUND' }, b: { code: 'VALIDATION_ERROR' } };
    let n = 0;
    const api = fakeApi({ callVoiceFunction: async () => ({ status: n++ === 0 ? 404 : 400, body: bodies[n === 1 ? 'a' : 'b'] }) });
    const result = await relayFunctionCalls(api, 'vs-1', [
      { id: 'a', name: 'add_to_cart', args: {} },
      { id: 'b', name: 'add_to_cart', args: {} },
    ]);
    expect(result.responses.map((r) => r.response)).toEqual([bodies.a, bodies.b]);
    expect(result.fatal).toBe(false);
  });

  it('AC17: 503 หรือ 500 หรือเน็ตล้ม fatal และหยุดทันที', async () => {
    for (const impl of [
      async () => ({ status: 503, body: {} }),
      async () => ({ status: 500, body: {} }),
      async () => { throw new TypeError('network'); },
    ]) {
      const api = fakeApi({ callVoiceFunction: impl });
      const result = await relayFunctionCalls(api, 'vs-1', [
        { id: 'a', name: 'view_cart', args: {} },
        { id: 'b', name: 'view_cart', args: {} },
      ]);
      expect(result.fatal).toBe(true);
      expect(api.calls.callVoiceFunction).toHaveLength(1);
    }
  });
});
