// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { Kiosk } from '../components/Kiosk';
import type { Cart, Order } from '../lib/types';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const statusPageUrl = 'http://localhost:3000/q/?order=o-1';
const order: Order = {
  id: 'o-1', cartId: 'cart-1', status: 'PLACED', queueNumber: 17, placedAt: '2026-10-19T02:00:00Z',
  lines: [], total: { amount: '55.00', currency: 'THB' }, statusPageUrl,
};

function keys(...list: string[]) {
  let i = 0;
  return () => list[i++] ?? 'k-extra';
}

function setup(overrides = {}, newKey = keys('k-1', 'k-2')) {
  const api = fakeApi(overrides);
  const voice = fakeVoiceLink();
  render(<Kiosk api={api} voice={voice.link} newIdempotencyKey={newKey} />);
  return { api, user: userEvent.setup() };
}

async function toConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
  await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
  await user.click(await screen.findByRole('button', { name: 'ยืนยัน' }));
}

describe('ยืนยันออเดอร์', () => {
  it('AC23: ยืนยันสั่งสองครั้งเร็วๆ ใช้ key เดียว ได้คิวและ QR ของ statusPageUrl', async () => {
    const { api, user } = setup({ checkout: async () => order });
    await toConfirm(user);
    const confirm = await screen.findByRole('button', { name: 'ยืนยันสั่ง' });
    await user.dblClick(confirm);

    expect(await screen.findByText('หมายเลขคิวของคุณ')).toBeTruthy();
    expect(screen.getByText('17')).toBeTruthy();
    expect(api.calls.checkout.length).toBeGreaterThan(0);
    for (const call of api.calls.checkout) expect(call).toEqual(['cart-1', 'k-1']);
    expect(document.querySelector('svg title')?.textContent).toBe(statusPageUrl);
  });

  const repriced: Cart = {
    id: 'cart-1', status: 'OPEN', expiresAt: '2026-10-19T02:46:00Z', totalCups: 1,
    total: { amount: '99.00', currency: 'THB' },
    lines: [{
      id: 'line-1', menuItemId: 'espresso', name: 'เอสเพรสโซ่', options: [], quantity: 1,
      unitPrice: { amount: '99.00', currency: 'THB' }, lineTotal: { amount: '99.00', currency: 'THB' },
    }],
  };

  it('AC24: checkout ได้ PRICE_CHANGED กลับหน้าสั่ง แสดงข้อความ และแสดงตะกร้าใหม่จาก details', async () => {
    const { user } = setup({
      checkout: async () => {
        throw new ApiError(409, { code: 'PRICE_CHANGED', message: 'ราคามีการเปลี่ยนแปลง กรุณาตรวจยอดใหม่', details: { cart: repriced } });
      },
    });
    await toConfirm(user);
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));

    expect(await screen.findByText('ราคามีการเปลี่ยนแปลง กรุณาตรวจยอดใหม่')).toBeTruthy();
    expect(screen.getByLabelText('ตะกร้า')).toBeTruthy();
    expect(within(screen.getByLabelText('ตะกร้า')).getAllByText('99.00').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'ยืนยันสั่ง' })).toBeNull();
  });

  it('AC24: MENU_ITEM_UNAVAILABLE ไฮไลต์รายการตาม details.lineIds', async () => {
    const { user } = setup({
      checkout: async () => {
        throw new ApiError(409, { code: 'MENU_ITEM_UNAVAILABLE', message: 'บางเมนูหมดแล้ว', details: { lineIds: ['line-1'] } });
      },
    });
    await toConfirm(user);
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));

    expect(await screen.findByText('บางเมนูหมดแล้ว')).toBeTruthy();
    const row = within(screen.getByLabelText('ตะกร้า')).getByText('เอสเพรสโซ่').closest('li');
    expect(row?.getAttribute('data-problem')).toBe('true');
  });

  it('AC24: กดยืนยันใหม่หลัง checkout ล้ม ใช้ key ใหม่เพราะเข้าหน้ายืนยันใหม่', async () => {
    const { api, user } = setup({
      checkout: async () => {
        throw new ApiError(409, { code: 'MENU_ITEM_UNAVAILABLE', message: 'บางเมนูหมดแล้ว', details: { lineIds: ['line-1'] } });
      },
    });
    await toConfirm(user);
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));
    await user.click(await screen.findByRole('button', { name: 'ยืนยัน' }));
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));

    expect(api.calls.checkout.map((c) => c[1])).toEqual(['k-1', 'k-2']);
  });

  const expired = () => new ApiError(409, { code: 'CART_EXPIRED', message: 'ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่' });

  async function expectBackToWelcome() {
    expect(await screen.findByText('ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'เริ่มสั่ง' })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
    expect(screen.queryByText('ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่')).toBeNull();
  }

  it('AC25: checkout ได้ CART_EXPIRED แสดงข้อความแล้วกลับหน้าต้อนรับ', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({ checkout: async () => { throw expired(); } });
    render(<Kiosk api={api} voice={fakeVoiceLink().link} newIdempotencyKey={keys('k-1')} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await toConfirm(user);
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));
    await expectBackToWelcome();
  });

  it('AC25: addLine ได้ CART_EXPIRED ใช้กฎเดียวกัน กลับหน้าต้อนรับ', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({ addLine: async () => { throw expired(); } });
    render(<Kiosk api={api} voice={fakeVoiceLink().link} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
    await expectBackToWelcome();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('AC25: changeQuantity และ removeLine ได้ CART_EXPIRED กลับหน้าต้อนรับ', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({
      changeQuantity: async () => { throw expired(); },
      removeLine: async () => { throw expired(); },
    });
    render(<Kiosk api={api} voice={fakeVoiceLink().link} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
    await user.click(await screen.findByRole('button', { name: '+' }));
    await expectBackToWelcome();

    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
    await user.click(await screen.findByRole('button', { name: 'ลบ' }));
    await expectBackToWelcome();
  });
});
