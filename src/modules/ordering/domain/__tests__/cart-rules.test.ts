import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../shared/domain-error';
import { Cart } from '../cart';
import { americano, espresso, latte, matchaSoldOut } from './menu-fixtures';

const T0 = new Date('2026-10-19T02:30:00Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

function expectDomainError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return error as DomainError;
  }
  throw new Error(`expected DomainError ${code} but nothing was thrown`);
}

const latteM = (quantity: number, lineId = 'line-1') =>
  ({ lineId, item: latte, optionChoiceIds: ['size-m'], quantity });

describe('Cart rules', () => {
  it('AC8: เพิ่มเมนูที่หมดไม่ได้ MENU_ITEM_UNAVAILABLE', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-1', item: matchaSoldOut, optionChoiceIds: ['size-m'], quantity: 1 }, T0),
      'MENU_ITEM_UNAVAILABLE',
    );
    expect(cart.lines).toEqual([]);
  });

  it('AC9: ไม่เลือกขนาดซึ่งเป็นกลุ่มบังคับ OPTION_REQUIRED', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['milk-oat'], quantity: 1 }, T0),
      'OPTION_REQUIRED',
    );
  });

  it('AC10: ตัวเลือกที่ไม่อยู่ในเมนูนั้น INVALID_OPTION', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['size-m', 'whip-cream'], quantity: 1 }, T0),
      'INVALID_OPTION',
    );
  });

  it('AC10: เลือก 2 ค่าในกลุ่มเดียว INVALID_OPTION', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['size-m', 'size-l'], quantity: 1 }, T0),
      'INVALID_OPTION',
    );
  });

  it('AC10: เลือกตัวเลือกเดิมซ้ำ INVALID_OPTION', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['size-m', 'size-m'], quantity: 1 }, T0),
      'INVALID_OPTION',
    );
  });

  it.each([0, 11, -1])('AC11: เพิ่มจำนวน %i แก้ว QUANTITY_OUT_OF_RANGE', (quantity) => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(() => cart.addLine(latteM(quantity), T0), 'QUANTITY_OUT_OF_RANGE');
  });

  it.each([0, 11])('AC11: แก้จำนวนเป็น %i แก้ว QUANTITY_OUT_OF_RANGE', (quantity) => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(2), T0);

    expectDomainError(() => cart.changeQuantity('line-1', quantity, T0), 'QUANTITY_OUT_OF_RANGE');
    expect(cart.lines[0]!.quantity).toBe(2);
  });

  it('AC11: เพิ่มซ้ำจนรายการเดิมเกิน 10 แก้ว QUANTITY_OUT_OF_RANGE', () => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(2), T0);

    expectDomainError(() => cart.addLine(latteM(9, 'line-2'), T0), 'QUANTITY_OUT_OF_RANGE');
    expect(cart.lines[0]!.quantity).toBe(2);
  });

  it('AC12: ตะกร้า 18 แก้ว เพิ่มอีก 3 แก้ว CART_LIMIT_REACHED ตะกร้าไม่เปลี่ยน', () => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(10), T0);
    cart.addLine({ lineId: 'line-2', item: americano, optionChoiceIds: ['size-m'], quantity: 8 }, T0);

    expectDomainError(
      () => cart.addLine({ lineId: 'line-3', item: espresso, optionChoiceIds: [], quantity: 3 }, T0),
      'CART_LIMIT_REACHED',
    );
    expect(cart.totalCups).toBe(18);
    expect(cart.lines).toHaveLength(2);
  });

  it('AC12: ตะกร้า 20 แก้วพอดีได้', () => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(10), T0);
    cart.addLine({ lineId: 'line-2', item: americano, optionChoiceIds: ['size-m'], quantity: 10 }, T0);

    expect(cart.totalCups).toBe(20);
  });

  it('AC12: แก้จำนวนจนรวมเกิน 20 แก้ว CART_LIMIT_REACHED', () => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(10), T0);
    cart.addLine({ lineId: 'line-2', item: americano, optionChoiceIds: ['size-m'], quantity: 5 }, T0);
    cart.addLine({ lineId: 'line-3', item: espresso, optionChoiceIds: [], quantity: 5 }, T0);

    expectDomainError(() => cart.changeQuantity('line-3', 6, T0), 'CART_LIMIT_REACHED');
    expect(cart.lines[2]!.quantity).toBe(5);
    expect(cart.totalCups).toBe(20);
  });

  it('AC13: แก้หรือลบรายการที่ไม่มี CART_LINE_NOT_FOUND', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(() => cart.changeQuantity('missing', 1, T0), 'CART_LINE_NOT_FOUND');
    expectDomainError(() => cart.removeLine('missing', T0), 'CART_LINE_NOT_FOUND');
  });

  it('AC14: ตะกร้าไม่ได้แก้ไขครบ 15 นาที แก้ไขไม่ได้ CART_EXPIRED', () => {
    const cart = Cart.start('cart-1', T0);
    cart.addLine(latteM(1), T0);

    expectDomainError(() => cart.addLine(latteM(1), minutes(15)), 'CART_EXPIRED');
    expectDomainError(() => cart.changeQuantity('line-1', 2, minutes(15)), 'CART_EXPIRED');
    expectDomainError(() => cart.removeLine('line-1', minutes(15)), 'CART_EXPIRED');
  });

  it('AC14: แก้ไขก่อนครบ 15 นาทีได้ และนับเวลาใหม่จากครั้งล่าสุด', () => {
    const cart = Cart.start('cart-1', T0);

    cart.addLine(latteM(1), minutes(14));
    cart.changeQuantity('line-1', 2, minutes(28));

    expect(cart.expiresAt).toEqual(minutes(43));
  });

  it('AC19: ตะกร้าที่ยืนยันแล้วแก้ไขไม่ได้ CART_ALREADY_CHECKED_OUT', () => {
    const cart = Cart.restore({
      id: 'cart-1',
      status: 'CHECKED_OUT',
      lastActivityAt: T0,
      lines: [{ id: 'line-1', menuItemId: 'latte', optionChoiceIds: ['size-m'], quantity: 1, unitPriceSatang: 5500 }],
    });

    expectDomainError(() => cart.addLine(latteM(1, 'line-2'), T0), 'CART_ALREADY_CHECKED_OUT');
    expectDomainError(() => cart.changeQuantity('line-1', 2, T0), 'CART_ALREADY_CHECKED_OUT');
    expectDomainError(() => cart.removeLine('line-1', T0), 'CART_ALREADY_CHECKED_OUT');
  });
});
