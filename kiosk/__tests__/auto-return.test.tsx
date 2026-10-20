// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Kiosk } from '../components/Kiosk';
import type { Order } from '../lib/types';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

// RTL ตรวจ fake timers ผ่านตัวแปร global `jest` เท่านั้น; ให้ shim เพื่อให้ findBy*/user-event เดินเวลาปลอมเอง (ไม่พึ่งเวลาจริง)
beforeEach(() => {
  (globalThis as { jest?: unknown }).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };
});

afterEach(() => {
  delete (globalThis as { jest?: unknown }).jest;
  cleanup();
  vi.useRealTimers();
});

const order: Order = {
  id: 'o-1', cartId: 'cart-1', status: 'PLACED', queueNumber: 17, placedAt: '2026-10-19T02:00:00Z',
  lines: [], total: { amount: '55.00', currency: 'THB' }, statusPageUrl: 'http://localhost:3000/q/?order=o-1',
};

function setup() {
  vi.useFakeTimers();
  const api = fakeApi({ checkout: async () => order });
  render(<Kiosk api={api} voice={fakeVoiceLink().link} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { api, user };
}

async function addEspresso(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
  await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
  await screen.findByRole('button', { name: 'ลบ' });
}

async function toQueue(user: ReturnType<typeof userEvent.setup>) {
  await addEspresso(user);
  await user.click(await screen.findByRole('button', { name: 'ยืนยัน' }));
  const place = await screen.findByRole('button', { name: 'ยืนยันสั่ง' });
  // ไม่ผ่านเวลาจริงระหว่างรอ เพื่อให้นับ 30 วินาทีจากตอนเข้าหน้าคิวพอดี
  await act(async () => { fireEvent.click(place); });
  expect(screen.getByText('หมายเลขคิวของคุณ')).toBeTruthy();
}

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('UC-04 queue auto return', () => {
  it('AC26: หน้าคิวกลับหน้าต้อนรับหลัง 30 วินาที หรือเมื่อแตะเสร็จสิ้น', async () => {
    const { api, user } = setup();
    await toQueue(user);

    await advance(29_999);
    expect(screen.getByText('หมายเลขคิวของคุณ')).toBeTruthy();
    await advance(1);
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
    expect(screen.queryByText('หมายเลขคิวของคุณ')).toBeNull();

    await toQueue(user);
    await user.click(screen.getByRole('button', { name: 'เสร็จสิ้น' }));
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await screen.findByRole('button', { name: /^เอสเพรสโซ่/ });
    expect(api.calls.startCart.length).toBe(3);
  });

  it('AC26: หน้าคิวไม่ถูกตัดโดยคำถามยังสั่งอยู่ไหมที่ค้างจากหน้ายืนยัน', async () => {
    const { user } = setup();
    await addEspresso(user);
    await user.click(await screen.findByRole('button', { name: 'ยืนยัน' }));
    const place = await screen.findByRole('button', { name: 'ยืนยันสั่ง' });
    await advance(120_000);
    expect(screen.getByText('ยังสั่งอยู่ไหม')).toBeTruthy();

    await act(async () => { fireEvent.click(place); });
    expect(screen.getByText('หมายเลขคิวของคุณ')).toBeTruthy();
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();
    await advance(29_999);
    expect(screen.getByText('หมายเลขคิวของคุณ')).toBeTruthy();
    await advance(1);
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
  });
});
