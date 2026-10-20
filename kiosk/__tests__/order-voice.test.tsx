// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
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
