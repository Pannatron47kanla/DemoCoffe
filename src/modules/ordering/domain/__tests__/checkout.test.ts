import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../shared/domain-error';
import { BusinessDay } from '../business-day';
import { Cart } from '../cart';
import { Order } from '../order';
import { QueueNumber } from '../queue-number';
import { americano, latte, soldOut, withPrice } from './menu-fixtures';

const T0 = new Date('2026-10-19T02:30:00Z'); // 09:30 Asia/Bangkok
const menu = [latte, americano];

function expectDomainError(fn: () => unknown, code: string): DomainError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return error as DomainError;
  }
  throw new Error(`expected DomainError ${code} but nothing was thrown`);
}

function cartWithTwoLattes() {
  const cart = Cart.start('cart-1', T0);
  cart.addLine({ lineId: 'line-1', item: latte, optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 }, T0);
  return cart;
}

const checkoutInput = (overrides: Partial<Parameters<Cart['checkout']>[0]> = {}) => ({
  orderId: 'order-1',
  idempotencyKey: 'k-123',
  menu,
  queueNumber: QueueNumber.of(1),
  now: T0,
  ...overrides,
});

describe('Cart.checkout', () => {
  it('AC15: ยืนยันได้ออเดอร์ PLACED คิว 1 ยอดรวมตามตะกร้า และตะกร้าปิด', () => {
    const cart = cartWithTwoLattes();

    const order = cart.checkout(checkoutInput());

    expect(order.id).toBe('order-1');
    expect(order.cartId).toBe('cart-1');
    expect(order.status).toBe('PLACED');
    expect(order.queueNumber.value).toBe(1);
    expect(order.businessDay.value).toBe('2026-10-19');
    expect(order.placedAt).toEqual(T0);
    expect(order.total.satang).toBe(16000);
    expect(order.lines).toEqual([
      {
        menuItemId: 'latte',
        name: 'ลาเต้',
        options: [
          { choiceId: 'size-l', groupName: 'ขนาด', name: 'L', priceDeltaSatang: 1000 },
          { choiceId: 'milk-oat', groupName: 'นม', name: 'นมโอ๊ต', priceDeltaSatang: 1500 },
        ],
        quantity: 2,
        unitPriceSatang: 8000,
      },
    ]);
    expect(cart.status).toBe('CHECKED_OUT');
  });

  it('AC14: ยืนยันตะกร้าที่ไม่ได้แก้ไขครบ 15 นาที CART_EXPIRED', () => {
    const cart = cartWithTwoLattes();

    expectDomainError(() => cart.checkout(checkoutInput({ now: new Date(T0.getTime() + 15 * 60_000) })), 'CART_EXPIRED');
    expect(cart.status).toBe('OPEN');
  });

  it('AC19: ยืนยันตะกร้าที่ยืนยันแล้ว CART_ALREADY_CHECKED_OUT', () => {
    const cart = cartWithTwoLattes();
    cart.checkout(checkoutInput());

    expectDomainError(() => cart.checkout(checkoutInput({ orderId: 'order-2', idempotencyKey: 'k-new' })), 'CART_ALREADY_CHECKED_OUT');
  });

  it('AC20: ยืนยันตะกร้าว่าง CART_EMPTY', () => {
    const cart = Cart.start('cart-1', T0);

    expectDomainError(() => cart.checkout(checkoutInput()), 'CART_EMPTY');
    expect(cart.status).toBe('OPEN');
  });

  it('AC21: เมนูในตะกร้าหมดภายหลัง MENU_ITEM_UNAVAILABLE พร้อมบอกรายการที่หมด', () => {
    const cart = cartWithTwoLattes();
    cart.addLine({ lineId: 'line-2', item: americano, optionChoiceIds: ['size-m'], quantity: 1 }, T0);

    const error = expectDomainError(
      () => cart.checkout(checkoutInput({ menu: [soldOut(latte), americano] })),
      'MENU_ITEM_UNAVAILABLE',
    );
    expect(error.details).toEqual({ lineIds: ['line-1'] });
    expect(cart.status).toBe('OPEN');
  });

  it('AC21: เมนูถูกลบออกจากเมนูแล้วถือว่าหมด', () => {
    const cart = cartWithTwoLattes();

    const error = expectDomainError(() => cart.checkout(checkoutInput({ menu: [americano] })), 'MENU_ITEM_UNAVAILABLE');
    expect(error.details).toEqual({ lineIds: ['line-1'] });
  });

  it('AC22: ราคาเปลี่ยนหลังใส่ตะกร้า reviewPrices ปรับราคา แล้ว checkout ปฏิเสธ PRICE_CHANGED', () => {
    const cart = cartWithTwoLattes();
    const newMenu = [withPrice(latte, 6000), americano];

    cart.reviewPrices(newMenu, T0);

    expect(cart.lines[0]!.unitPrice.satang).toBe(8500);
    expect(cart.total.satang).toBe(17000);
    expectDomainError(() => cart.checkout(checkoutInput({ menu: newMenu })), 'PRICE_CHANGED');
    expect(cart.status).toBe('OPEN');
  });

  it('AC22: ยืนยันอีกครั้งด้วยราคาใหม่ได้ (โหลดตะกร้าที่ปรับราคาแล้วใหม่)', () => {
    const cart = cartWithTwoLattes();
    const newMenu = [withPrice(latte, 6000), americano];
    cart.reviewPrices(newMenu, T0);
    const reloaded = Cart.restore(cart.toState());

    reloaded.reviewPrices(newMenu, T0);
    const order = reloaded.checkout(checkoutInput({ menu: newMenu }));

    expect(order.total.satang).toBe(17000);
  });

  it('AC22: checkout ตรวจราคาเองแม้ไม่ได้เรียก reviewPrices', () => {
    const cart = cartWithTwoLattes();

    expectDomainError(() => cart.checkout(checkoutInput({ menu: [withPrice(latte, 6000)] })), 'PRICE_CHANGED');
  });

  it('AC24: ออเดอร์เก็บชื่อและราคา ณ ตอนยืนยัน ไม่ตามเมนูที่แก้ภายหลัง', () => {
    const mutableLatte = structuredClone(latte) as { -readonly [K in keyof typeof latte]: (typeof latte)[K] };
    const cart = Cart.start('cart-1', T0);
    cart.addLine({ lineId: 'line-1', item: mutableLatte, optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 }, T0);
    const order = cart.checkout(checkoutInput({ menu: [mutableLatte] }));

    mutableLatte.name = 'ลาเต้สูตรใหม่';
    mutableLatte.basePriceSatang = 9900;
    const restored = Order.restore(order.toState());

    expect(order.lines[0]!.name).toBe('ลาเต้');
    expect(restored.lines[0]!.name).toBe('ลาเต้');
    expect(restored.lines[0]!.unitPriceSatang).toBe(8000);
    expect(restored.total.satang).toBe(16000);
  });
});

describe('Order.replayFor', () => {
  const placed = () => cartWithTwoLattes().checkout(checkoutInput());

  it('AC18: key เดิมกับตะกร้าเดิม คืนออเดอร์เดิม', () => {
    const order = placed();

    expect(order.replayFor('cart-1')).toBe(order);
  });

  it('AC25: key เดิมกับตะกร้าอื่น IDEMPOTENCY_KEY_CONFLICT', () => {
    const order = placed();

    expectDomainError(() => order.replayFor('cart-2'), 'IDEMPOTENCY_KEY_CONFLICT');
  });
});

describe('BusinessDay', () => {
  it('AC17: วันทำการเปลี่ยนตอน 00:00 Asia/Bangkok', () => {
    expect(BusinessDay.of(new Date('2026-10-19T16:59:59Z')).value).toBe('2026-10-19'); // 23:59:59 BKK
    expect(BusinessDay.of(new Date('2026-10-19T17:00:00Z')).value).toBe('2026-10-20'); // 00:00 BKK
  });
});

describe('QueueNumber', () => {
  it('AC15: หมายเลขคิวเริ่มที่ 1 และต้องเป็นจำนวนเต็มบวก', () => {
    expect(QueueNumber.of(1).value).toBe(1);
    expect(() => QueueNumber.of(0)).toThrow();
    expect(() => QueueNumber.of(1.5)).toThrow();
  });
});
