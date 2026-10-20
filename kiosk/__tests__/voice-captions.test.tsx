// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { Kiosk } from '../components/Kiosk';
import type { Order, VoiceSession } from '../lib/types';
import { QUEUE_RETURN_MS } from '../lib/timing';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

// RTL ตรวจ fake timers ผ่านตัวแปร global `jest` เท่านั้น (รูปแบบเดียวกับ idle.test.tsx)
beforeEach(() => {
  (globalThis as { jest?: unknown }).jest = { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) };
});
afterEach(() => {
  delete (globalThis as { jest?: unknown }).jest;
  cleanup();
  vi.useRealTimers();
});

const session: VoiceSession = {
  id: 'vs-1', cartId: 'cart-1', consentTextVersion: 'v1', consentedAt: '2026-10-20T02:00:00Z',
  connection: { token: 'tok-1', model: 'gemini-live', startBefore: '2026-10-20T02:01:00Z' },
};
const order: Order = {
  id: 'o-1', cartId: 'cart-1', status: 'PLACED', queueNumber: 17, placedAt: '2026-10-20T02:00:00Z',
  lines: [], total: { amount: '0.00', currency: 'THB' }, statusPageUrl: 'http://localhost:3000/q/?order=o-1',
};

async function voiceOrdering(overrides = {}, fake = fakeVoiceLink()) {
  vi.useFakeTimers();
  const api = fakeApi({ startVoiceSession: async () => session, ...overrides });
  render(<Kiosk api={api} voice={fake.link} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
  await user.click(await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' }));
  await user.click(await screen.findByRole('button', { name: 'ยินยอม' }));
  await screen.findByRole('button', { name: '⏹ หยุดเสียง' });
  return { user, api, fake };
}

const say = (fake: ReturnType<typeof fakeVoiceLink>, role: 'user' | 'model', text: string) =>
  act(async () => { fake.handlers().onTranscript(role, text); });

describe('UC-04 captions', () => {
  it('AC22: แสดงคำบรรยายของลูกค้าและ Gemini ไม่มีคำขอไป api', async () => {
    const { api, fake } = await voiceOrdering();
    const before = JSON.stringify(Object.values(api.calls).map((c) => c.length));
    await say(fake, 'user', 'ขอลาเต้แก้วใหญ่');
    await say(fake, 'model', 'ใส่ลาเต้ L ให้แล้วค่ะ');

    expect(screen.getByText('👤 ขอลาเต้แก้วใหญ่')).toBeTruthy();
    expect(screen.getByText('🤖 ใส่ลาเต้ L ให้แล้วค่ะ')).toBeTruthy();
    expect(JSON.stringify(Object.values(api.calls).map((c) => c.length))).toBe(before);
  });

  it('AC22: ข้อความต่อเนื่องของคนเดิมต่อท้ายบรรทัดล่าสุด', async () => {
    const { fake } = await voiceOrdering();
    await say(fake, 'user', 'ขอลาเต้');
    await say(fake, 'user', 'แก้วใหญ่');

    expect(screen.getByText('👤 ขอลาเต้แก้วใหญ่')).toBeTruthy();
  });

  it('AC22: คำบรรยายของเซสชันเก่าหลังหยุดเสียง ไม่ถูกแสดง', async () => {
    const { user, fake } = await voiceOrdering();
    const old = fake.handlers();
    await user.click(screen.getByRole('button', { name: '⏹ หยุดเสียง' }));
    await act(async () => { old.onTranscript('user', 'เสียงตกค้าง'); });

    expect(screen.queryByText(/เสียงตกค้าง/)).toBeNull();
  });

  it('AC22: กลับหน้าต้อนรับระหว่างเปิดเสียง (หน้าคิว) ปิดการเชื่อมต่อและล้างคำบรรยาย', async () => {
    const { user, fake } = await voiceOrdering({
      checkout: async () => order,
      callVoiceFunction: async () => ({ status: 200, body: { action: 'SHOW_CHECKOUT', cart: { id: 'cart-1', status: 'OPEN', expiresAt: '2026-10-20T02:46:00Z', totalCups: 0, total: { amount: '0.00', currency: 'THB' }, lines: [] } } }),
    });
    await say(fake, 'user', 'ขอลาเต้แก้วใหญ่');
    await act(async () => { fake.handlers().onFunctionCalls([{ id: 'c1', name: 'request_checkout', args: {} }]); });
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));
    await screen.findByText('หมายเลขคิวของคุณ');

    await act(async () => { await vi.advanceTimersByTimeAsync(QUEUE_RETURN_MS); });
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
    expect(fake.closed).toBe(true);

    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' });
    expect(screen.queryByText(/ขอลาเต้แก้วใหญ่/)).toBeNull();
  });

  it('AC22: กลับหน้าต้อนรับระหว่างเปิดเสียง (CART_EXPIRED) ปิดการเชื่อมต่อและล้างคำบรรยาย', async () => {
    const expired = new ApiError(409, { code: 'CART_EXPIRED', message: 'ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่' });
    const { user, fake } = await voiceOrdering({ addLine: async () => { throw expired; } });
    await say(fake, 'user', 'ขอลาเต้แก้วใหญ่');
    await user.click(screen.getByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(screen.getByRole('button', { name: 'ใส่ตะกร้า' }));
    await screen.findByText('ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่');

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
    expect(fake.closed).toBe(true);

    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' });
    expect(screen.queryByText(/ขอลาเต้แก้วใหญ่/)).toBeNull();
  });

  it('AC22: ยืนยันสั่งสำเร็จขึ้นหน้าคิว ปิดเสียงและล้างคำบรรยายทันที', async () => {
    const cart = { id: 'cart-1', status: 'OPEN', expiresAt: '2026-10-20T02:46:00Z', totalCups: 0, total: { amount: '0.00', currency: 'THB' }, lines: [] };
    const { user, fake } = await voiceOrdering({
      checkout: async () => order,
      callVoiceFunction: async () => ({ status: 200, body: { action: 'SHOW_CHECKOUT', cart } }),
    });
    await say(fake, 'user', 'ขอลาเต้แก้วใหญ่');
    await act(async () => { fake.handlers().onFunctionCalls([{ id: 'c1', name: 'request_checkout', args: {} }]); });
    await user.click(await screen.findByRole('button', { name: 'ยืนยันสั่ง' }));
    await screen.findByText('หมายเลขคิวของคุณ');

    expect(fake.closed).toBe(true);
    await user.click(screen.getByRole('button', { name: 'เสร็จสิ้น' }));
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' });
    expect(screen.queryByText(/ขอลาเต้แก้วใหญ่/)).toBeNull();
  });

  it('AC22: กลับหน้าต้อนรับระหว่างกำลังเปิดเสียงไม่เปิดเสียงค้าง', async () => {
    vi.useFakeTimers();
    const closes: boolean[] = [];
    let release: () => void = () => {};
    const link = {
      connect: () => new Promise<{ sendFunctionResponses: () => void; close: () => void }>((res) => {
        release = () => res({ sendFunctionResponses: () => {}, close: () => { closes.push(true); } });
      }),
    };
    const expired = new ApiError(409, { code: 'CART_EXPIRED', message: 'ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่' });
    const api = fakeApi({ startVoiceSession: async () => session, addLine: async () => { throw expired; } });
    render(<Kiosk api={api} voice={link} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' }));
    await user.click(await screen.findByRole('button', { name: 'ยินยอม' }));
    await user.click(screen.getByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(screen.getByRole('button', { name: 'ใส่ตะกร้า' }));
    await screen.findByText('ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่');
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();

    await act(async () => { release(); });
    expect(closes).toEqual([true]);
    expect(screen.queryByRole('button', { name: '⏹ หยุดเสียง' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    expect(await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' })).toBeTruthy();
  });
});
