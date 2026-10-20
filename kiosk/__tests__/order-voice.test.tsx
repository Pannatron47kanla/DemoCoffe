// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VoiceSession } from '../lib/types';
import { Kiosk } from '../components/Kiosk';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

afterEach(cleanup);

async function ordering(api = fakeApi(), fake = fakeVoiceLink()) {
  render(<Kiosk api={api} voice={fake.link} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
  await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' });
  return { user, api, fake };
}

describe('UC-04 voice consent', () => {
  it('AC13: แตะสั่งด้วยเสียงครั้งแรกแสดงข้อความยินยอมจาก API ปุ่มสองปุ่มขนาดเท่ากัน', async () => {
    const api = fakeApi({ getConsentText: async () => ({ version: 'voice-demo-v1', text: 'เสียงของคุณจะถูกส่งไปประมวลผล' }) });
    const { user } = await ordering(api);
    await user.click(screen.getByRole('button', { name: '🎤 สั่งด้วยเสียง' }));

    expect(await screen.findByText('เสียงของคุณจะถูกส่งไปประมวลผล')).toBeTruthy();
    const accept = screen.getByRole('button', { name: 'ยินยอม' });
    const decline = screen.getByRole('button', { name: 'ไม่ใช่ตอนนี้' });
    expect(accept.className).toBeTruthy();
    expect(accept.className).toBe(decline.className);
  });

  it('AC14: แตะ ไม่ใช่ตอนนี้ ปิดแผ่น ไม่เรียก startVoiceSession แตะเมนูต่อได้', async () => {
    const { user, api, fake } = await ordering();
    await user.click(screen.getByRole('button', { name: '🎤 สั่งด้วยเสียง' }));
    await user.click(await screen.findByRole('button', { name: 'ไม่ใช่ตอนนี้' }));

    expect(screen.queryByRole('button', { name: 'ยินยอม' })).toBeNull();
    expect(api.calls.startVoiceSession).toHaveLength(0);
    expect(fake.connections).toBe(0);
    await user.click(screen.getByRole('button', { name: /^เอสเพรสโซ่/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

const session: VoiceSession = {
  id: 'vs-1',
  cartId: 'cart-1',
  consentTextVersion: 'voice-demo-v1',
  consentedAt: '2026-10-20T02:00:00Z',
  connection: { token: 'tok-1', model: 'gemini-live', startBefore: '2026-10-20T02:01:00Z' },
};
const voiceApi = () =>
  fakeApi({
    getConsentText: async () => ({ version: 'voice-demo-v1', text: 'ข้อความยินยอม' }),
    startVoiceSession: async () => session,
  });

describe('UC-04 voice session', () => {
  it('AC15: แตะยินยอมส่ง cartId และเวอร์ชันที่แสดง แล้ว connect ด้วยโทเคน ปุ่มเป็นหยุดเสียง', async () => {
    const connect = vi.fn();
    const fake = fakeVoiceLink();
    const link = { connect: (...a: Parameters<typeof fake.link.connect>) => (connect(...a), fake.link.connect(...a)) };
    const api = voiceApi();
    render(<Kiosk api={api} voice={link} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' }));
    await user.click(await screen.findByRole('button', { name: 'ยินยอม' }));

    expect(await screen.findByRole('button', { name: '⏹ หยุดเสียง' })).toBeTruthy();
    expect(api.calls.startVoiceSession[0]).toEqual(['cart-1', 'voice-demo-v1']);
    expect(fake.connections).toBe(1);
    expect(connect.mock.calls[0]?.[0]).toEqual(session.connection);
    expect(screen.queryByRole('button', { name: 'ยินยอม' })).toBeNull();
  });

  it('AC17: add_to_cart จาก Gemini แสดงตะกร้าจาก response', async () => {
    const cart = {
      id: 'cart-1', status: 'OPEN', expiresAt: '2026-10-20T02:46:00Z', totalCups: 2, total: { amount: '160.00', currency: 'THB' },
      lines: [{
        id: 'l1', menuItemId: 'latte', name: 'ลาเต้', options: [], quantity: 2,
        unitPrice: { amount: '80.00', currency: 'THB' }, lineTotal: { amount: '160.00', currency: 'THB' },
      }],
    };
    const body = { action: 'SHOW_CART', cart };
    const api = fakeApi({
      getConsentText: async () => ({ version: 'voice-demo-v1', text: 'ข้อความยินยอม' }),
      startVoiceSession: async () => session,
      callVoiceFunction: async () => ({ status: 200, body }),
    });
    const fake = fakeVoiceLink();
    render(<Kiosk api={api} voice={fake.link} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: '🎤 สั่งด้วยเสียง' }));
    await user.click(await screen.findByRole('button', { name: 'ยินยอม' }));
    await screen.findByRole('button', { name: '⏹ หยุดเสียง' });

    await act(async () => { fake.handlers().onFunctionCalls([{ id: 'fc1', name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 2 } }]); });

    await waitFor(() => expect(fake.responses).toHaveLength(1));
    expect(api.calls.callVoiceFunction[0]).toEqual(['vs-1', { name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 2 } }]);
    expect(fake.responses[0]).toEqual([{ id: 'fc1', name: 'add_to_cart', response: body }]);
    expect(screen.getAllByText(/160\.00/).length).toBeGreaterThan(0);
  });
});
