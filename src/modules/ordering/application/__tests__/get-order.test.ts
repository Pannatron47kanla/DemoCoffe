import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { sequentialIds } from '../../../../shared/ids';
import { americano, latte } from '../../domain/__tests__/menu-fixtures';
import { CheckoutCart } from '../checkout-cart';
import { GetOrder } from '../get-order';
import { FakeMenu, InMemoryOrdering } from './fakes';

describe('GetOrder', () => {
  it('AC2: GetOrder คืนออเดอร์ที่ยืนยันแล้ว', async () => {
    const uow = new InMemoryOrdering();
    const clock = fixedClock('2026-10-19T02:30:00Z');
    uow.carts.set('cart-a', {
      id: 'cart-a',
      status: 'OPEN',
      lastActivityAt: clock.now(),
      lines: [{ id: 'line-1', menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2, unitPriceSatang: 8000 }],
    });
    const checkout = new CheckoutCart({ uow, menu: new FakeMenu([latte, americano]), clock, ids: sequentialIds() });
    const { order: placed } = await checkout.execute({ cartId: 'cart-a', idempotencyKey: 'k-1' });

    const order = await new GetOrder({ uow }).execute(placed.id);

    expect(order.queueNumber.value).toBe(1);
    expect(order.lines[0]?.quantity).toBe(2);
    expect(order.total.satang).toBe(16000);
  });
});
