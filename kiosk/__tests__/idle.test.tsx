// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Kiosk } from '../components/Kiosk';
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

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

// คืนตะกร้าที่มีของแล้ว ณ หน้าสั่ง; จบด้วย pointerdown เพื่อให้นับเวลา idle จากจุดนี้พอดี
async function orderingWithCart() {
  vi.useFakeTimers();
  render(<Kiosk api={fakeApi()} voice={fakeVoiceLink().link} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
  await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));
  await screen.findByRole('button', { name: 'ยืนยัน' });
  await act(async () => { fireEvent.pointerDown(document); });
  return user;
}

describe('UC-04 idle prompt', () => {
  it('AC27: ไม่แตะ 2 นาทีถาม ยังสั่งอยู่ไหม แล้วอีก 15 วินาทีกลับหน้าต้อนรับ', async () => {
    await orderingWithCart();

    await advance(119_999);
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();
    await advance(1);
    expect(screen.getByText('ยังสั่งอยู่ไหม')).toBeTruthy();

    await advance(14_999);
    expect(screen.getByText('ยังสั่งอยู่ไหม')).toBeTruthy();
    await advance(1);
    expect(screen.getByRole('button', { name: 'เริ่มสั่ง' })).toBeTruthy();
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();
  });

  it('AC27: แตะ ยังสั่งอยู่ ระหว่าง 15 วินาที อยู่หน้าเดิม', async () => {
    const user = await orderingWithCart();
    await advance(120_000);
    await advance(10_000);
    await user.click(screen.getByRole('button', { name: 'ยังสั่งอยู่' }));
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();

    await advance(20_000);
    expect(screen.queryByRole('button', { name: 'เริ่มสั่ง' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ยืนยัน' })).toBeTruthy();
  });

  it('AC27: ใช้กับหน้ายืนยันด้วย และการแตะรีเซ็ตเวลานับ', async () => {
    const user = await orderingWithCart();
    await user.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    await screen.findByRole('button', { name: 'ยืนยันสั่ง' });
    await act(async () => { fireEvent.pointerDown(document); });

    await advance(100_000);
    await act(async () => { fireEvent.pointerDown(document); });
    await advance(119_999);
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();
    await advance(1);
    expect(screen.getByText('ยังสั่งอยู่ไหม')).toBeTruthy();
  });

  it('AC27: แตะที่ใดก็ได้ระหว่างคำถามยังสั่งอยู่ไหมถือว่ายังสั่งอยู่', async () => {
    await orderingWithCart();
    await advance(120_000);
    expect(screen.getByText('ยังสั่งอยู่ไหม')).toBeTruthy();

    await act(async () => { fireEvent.pointerDown(screen.getByRole('alertdialog')); });
    expect(screen.queryByText('ยังสั่งอยู่ไหม')).toBeNull();

    await advance(15_000);
    expect(screen.queryByRole('button', { name: 'เริ่มสั่ง' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ยืนยัน' })).toBeTruthy();
  });
});
