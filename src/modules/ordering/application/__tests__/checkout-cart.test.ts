import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { DomainError } from '../../../../shared/domain-error';
import { sequentialIds } from '../../../../shared/ids';
import { americano, latte, withPrice } from '../../domain/__tests__/menu-fixtures';
import { CheckoutCart } from '../checkout-cart';
import { FakeMenu, InMemoryOrdering } from './fakes';

async function expectDomainError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

describe('CheckoutCart', () => {
  let uow: InMemoryOrdering;
  let menu: FakeMenu;
  let clock: ReturnType<typeof fixedClock>;
  let checkout: CheckoutCart;

  function storeCart(id: string, latteUnitPriceSatang = 5500) {
    uow.carts.set(id, {
      id,
      status: 'OPEN',
      lastActivityAt: clock.now(),
      lines: [{ id: `${id}-line`, menuItemId: 'latte', optionChoiceIds: ['size-m'], quantity: 2, unitPriceSatang: latteUnitPriceSatang }],
    });
  }

  beforeEach(() => {
    uow = new InMemoryOrdering();
    menu = new FakeMenu([latte, americano]);
    clock = fixedClock('2026-10-19T02:30:00Z'); // 09:30 Asia/Bangkok
    checkout = new CheckoutCart({ uow, menu, clock, ids: sequentialIds() });
  });

  it('AC15: วันที่ยังไม่มีออเดอร์ ได้คิว 1 บันทึกออเดอร์ และตะกร้าปิด', async () => {
    storeCart('cart-a');

    const { order, replayed } = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' });

    expect(replayed).toBe(false);
    expect(order.queueNumber.value).toBe(1);
    expect(order.total.satang).toBe(11000);
    expect(uow.orders.get(order.id)?.queueNumber).toBe(1);
    expect(uow.cart('cart-a').status).toBe('CHECKED_OUT');
  });

  it('AC16: วันนี้ออกไปแล้ว 41 ใบ ได้คิว 42', async () => {
    uow.counters.set('2026-10-19', 41);
    storeCart('cart-a');

    const { order } = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' });

    expect(order.queueNumber.value).toBe(42);
  });

  it('AC17: เมื่อวานจบที่ 87 ออเดอร์แรกหลังเที่ยงคืนได้คิว 1', async () => {
    uow.counters.set('2026-10-19', 87);
    clock.set('2026-10-19T17:00:00Z'); // 00:00 ของ 2026-10-20 Asia/Bangkok
    storeCart('cart-a');

    const { order } = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' });

    expect(order.businessDay.value).toBe('2026-10-20');
    expect(order.queueNumber.value).toBe(1);
  });

  it('AC18: ยืนยันซ้ำด้วย key เดิม คืนออเดอร์เดิม ไม่ออกคิวใหม่', async () => {
    storeCart('cart-a');
    const first = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-123' });

    const again = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-123' });

    expect(again.replayed).toBe(true);
    expect(again.order.id).toBe(first.order.id);
    expect(again.order.queueNumber.value).toBe(1);
    expect(uow.orders.size).toBe(1);
    expect(uow.counters.get('2026-10-19')).toBe(1);
  });

  it('AC19: ยืนยันตะกร้าที่ยืนยันแล้วด้วย key ใหม่ CART_ALREADY_CHECKED_OUT', async () => {
    storeCart('cart-a');
    await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-123' });

    await expectDomainError(checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-new' }), 'CART_ALREADY_CHECKED_OUT');
  });

  it('AC13: ยืนยันตะกร้าที่ไม่มี CART_NOT_FOUND', async () => {
    await expectDomainError(checkout.execute({ cartId: 'missing', idempotencyKey: 'k-1' }), 'CART_NOT_FOUND');
  });

  it('AC22: ราคาเปลี่ยน ปฏิเสธ PRICE_CHANGED บันทึกราคาใหม่ในตะกร้า แล้วยืนยันอีกครั้งได้', async () => {
    storeCart('cart-a', 5000); // ใส่ตะกร้าตอน 50 บาท เมนูตอนนี้ 55

    await expectDomainError(checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' }), 'PRICE_CHANGED');
    expect(uow.cart('cart-a').total.satang).toBe(11000);
    expect(uow.cart('cart-a').status).toBe('OPEN');
    expect(uow.orders.size).toBe(0);

    const { order } = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-2' });
    expect(order.total.satang).toBe(11000);
  });

  it('AC22: ปรับราคาไม่ต่ออายุตะกร้า', async () => {
    storeCart('cart-a', 5000);
    const expiresAt = uow.cart('cart-a').expiresAt;
    menu.items = [withPrice(latte, 6000)];

    await expectDomainError(checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' }), 'PRICE_CHANGED');

    expect(uow.cart('cart-a').expiresAt).toEqual(expiresAt);
  });

  it('AC25: key ที่ใช้กับตะกร้า A แล้ว ใช้กับตะกร้า B ไม่ได้', async () => {
    storeCart('cart-a');
    storeCart('cart-b');
    await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-123' });

    await expectDomainError(checkout.execute({ cartId: 'cart-b', idempotencyKey: 'k-123' }), 'IDEMPOTENCY_KEY_CONFLICT');
    expect(uow.cart('cart-b').status).toBe('OPEN');
  });
});
