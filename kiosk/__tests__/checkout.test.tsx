// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Kiosk } from '../components/Kiosk';
import type { Order } from '../lib/types';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

afterEach(cleanup);

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
});
