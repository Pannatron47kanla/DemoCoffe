import { describe, expect, it } from 'vitest';
import { Cart } from '../cart';
import { latte } from './menu-fixtures';

const T0 = new Date('2026-10-19T02:30:00Z'); // 09:30 Asia/Bangkok

function cartWithLatteLOat(quantity = 2) {
  const cart = Cart.start('cart-1', T0);
  cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['size-l', 'milk-oat'], quantity }, T0);
  return cart;
}

describe('Cart', () => {
  it('AC1: เริ่มสั่งได้ตะกร้าว่าง ยอดรวม 0 และหมดอายุใน 15 นาที', () => {
    const cart = Cart.start('cart-1', T0);

    expect(cart.id).toBe('cart-1');
    expect(cart.status).toBe('OPEN');
    expect(cart.lines).toEqual([]);
    expect(cart.totalCups).toBe(0);
    expect(cart.total.satang).toBe(0);
    expect(cart.expiresAt).toEqual(new Date('2026-10-19T02:45:00Z'));
  });

  it('AC2: เพิ่มลาเต้ L นมโอ๊ต 2 แก้ว ราคาต่อแก้ว 80.00 รวม 160.00', () => {
    const cart = cartWithLatteLOat(2);

    expect(cart.lines).toHaveLength(1);
    const line = cart.lines[0]!;
    expect(line.menuItemId).toBe('latte');
    expect(line.optionChoiceIds).toEqual(['milk-oat', 'size-l']);
    expect(line.quantity).toBe(2);
    expect(line.unitPrice.satang).toBe(8000);
    expect(line.lineTotal.satang).toBe(16000);
    expect(cart.total.satang).toBe(16000);
    expect(cart.totalCups).toBe(2);
  });

  it('AC3: เพิ่มเมนูและตัวเลือกชุดเดียวกันซ้ำ รวมเข้ารายการเดิม', () => {
    const cart = cartWithLatteLOat(2);

    cart.addLine({ lineId: 'line-2', item: latte, optionChoiceIds: ['milk-oat', 'size-l'], quantity: 1 }, T0);

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.id).toBe('line-1');
    expect(cart.lines[0]!.quantity).toBe(3);
    expect(cart.total.satang).toBe(24000);
  });

  it('AC4: แก้จำนวนเป็น 4 แล้วยอดรวมอัปเดต', () => {
    const cart = cartWithLatteLOat(2);

    cart.changeQuantity('line-1', 4, T0);

    expect(cart.lines[0]!.quantity).toBe(4);
    expect(cart.total.satang).toBe(32000);
    expect(cart.totalCups).toBe(4);
  });

  it('AC5: ลบรายการแล้วตะกร้าว่าง ยอดรวม 0', () => {
    const cart = cartWithLatteLOat(2);

    cart.removeLine('line-1', T0);

    expect(cart.lines).toEqual([]);
    expect(cart.total.satang).toBe(0);
  });

  it('AC7 (UC-02): ensureOpen หลังไม่ได้แก้ไขครบ 15 นาที → CART_EXPIRED', () => {
    const cart = Cart.start('cart-1', T0);

    expect(() => cart.ensureOpen(new Date('2026-10-19T02:44:59Z'))).not.toThrow();
    expect(() => cart.ensureOpen(new Date('2026-10-19T02:45:00Z'))).toThrowError(expect.objectContaining({ code: 'CART_EXPIRED' }));
  });

  it('AC7 (UC-03): ensureReadyForCheckout ไม่เปลี่ยนสถานะและไม่ต่ออายุ', () => {
    const cart = cartWithLatteLOat(2);
    const expiresAt = cart.expiresAt;

    cart.ensureReadyForCheckout(new Date('2026-10-19T02:35:00Z'));

    expect(cart.status).toBe('OPEN');
    expect(cart.lines).toHaveLength(1);
    expect(cart.expiresAt).toEqual(expiresAt);
  });
});
