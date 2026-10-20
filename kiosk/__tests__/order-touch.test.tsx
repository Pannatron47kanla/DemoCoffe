// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Kiosk } from '../components/Kiosk';
import { fakeApi } from './support/fake-api';
import { fakeVoiceLink } from './support/fake-voice-link';

afterEach(cleanup);

function setup(overrides = {}) {
  const api = fakeApi(overrides);
  const voice = fakeVoiceLink();
  render(<Kiosk api={api} voice={voice.link} />);
  return { api, voice, user: userEvent.setup() };
}

describe('สั่งด้วยการแตะ', () => {
  it('AC8: แตะเริ่มสั่งสร้างตะกร้าหนึ่งใบและแสดงทุกเมนู มัทฉะลาเต้หมดแตะไม่ได้', async () => {
    const { api, user } = setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));

    for (const name of ['ลาเต้', 'อเมริกาโน่', 'เอสเพรสโซ่', 'มัทฉะลาเต้']) {
      expect(await screen.findByText(name)).toBeTruthy();
    }
    expect(api.calls.startCart.length).toBe(1);
    expect(screen.getByText('55.00')).toBeTruthy();
    const matcha = screen.getByRole('button', { name: /มัทฉะลาเต้/ }) as HTMLButtonElement;
    expect(matcha.disabled).toBe(true);
    expect(matcha.textContent).toContain('หมด');
  });

  it('AC9: เลือกลาเต้ L นมโอ๊ต 2 แก้วแล้วใส่ตะกร้า ตะกร้าแสดงตาม response', async () => {
    const { api, user } = setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^ลาเต้/ }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'L' }));
    await user.click(within(dialog).getByRole('button', { name: 'นมโอ๊ต' }));
    await user.click(within(dialog).getByRole('button', { name: '+' }));
    await user.click(within(dialog).getByRole('button', { name: 'ใส่ตะกร้า' }));

    expect(api.calls.addLine[0]).toEqual(['cart-1', { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 }]);
    const cart = within(await screen.findByLabelText('ตะกร้า'));
    expect(cart.getByText('ลาเต้')).toBeTruthy();
    expect(cart.getByText('L')).toBeTruthy();
    expect(cart.getByText('นมโอ๊ต')).toBeTruthy();
    expect(cart.getByText('x2')).toBeTruthy();
    expect(cart.getAllByText('160.00').length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('AC10: อเมริกาโน่ยังไม่เลือกขนาด แตะใส่ตะกร้าไม่ส่งคำขอและแจ้งให้เลือกขนาด', async () => {
    const { api, user } = setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^อเมริกาโน่/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));

    expect(api.calls.addLine.length).toBe(0);
    expect(screen.getByText('กรุณาเลือกขนาด')).toBeTruthy();
  });

  it('AC11: แตะ + เป็น 3 แล้วลบ ส่งคำขอและแสดงตาม response ทุกครั้ง', async () => {
    const { api, user } = setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^ลาเต้/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'L' }));
    await user.click(dialog.getByRole('button', { name: '+' }));
    await user.click(dialog.getByRole('button', { name: 'ใส่ตะกร้า' }));

    const cart = within(await screen.findByLabelText('ตะกร้า'));
    await user.click(cart.getByRole('button', { name: '+' }));
    expect(api.calls.changeQuantity[0]).toEqual(['cart-1', 'line-1', 3]);
    expect(await cart.findByText('x3')).toBeTruthy();

    await user.click(cart.getByRole('button', { name: 'ลบ' }));
    expect(api.calls.removeLine[0]).toEqual(['cart-1', 'line-1']);
    await waitFor(() => expect(cart.queryByText('ลาเต้')).toBeNull());
    expect(cart.getByText('0.00')).toBeTruthy();
  });

  it('AC11: ปุ่ม − ที่จำนวน 1 ไม่ส่งคำขอ ใช้ลบแทน', async () => {
    const { api, user } = setup();
    await user.click(screen.getByRole('button', { name: 'เริ่มสั่ง' }));
    await user.click(await screen.findByRole('button', { name: /^เอสเพรสโซ่/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ใส่ตะกร้า' }));

    const minus = within(await screen.findByLabelText('ตะกร้า')).getByRole('button', { name: '−' }) as HTMLButtonElement;
    await user.click(minus);
    expect(minus.disabled).toBe(true);
    expect(api.calls.changeQuantity.length).toBe(0);
  });
});
