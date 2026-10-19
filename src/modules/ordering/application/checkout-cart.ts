import type { Clock } from '../../../shared/clock';
import type { IdGenerator } from '../../../shared/ids';
import { BusinessDay } from '../domain/business-day';
import type { Order } from '../domain/order';
import { menuItemIdsOf, requireCart } from './cart-view';
import type { MenuLookup, UnitOfWork } from './ports';

export interface CheckoutResult {
  order: Order;
  /** true เมื่อเป็นการยืนยันซ้ำด้วย key เดิม (AC18) */
  replayed: boolean;
}

// UC-01 ขั้นที่ 4: ยืนยันออเดอร์และออกหมายเลขคิว
export class CheckoutCart {
  constructor(private readonly deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock; ids: IdGenerator }) {}

  async execute(input: { cartId: string; idempotencyKey: string }): Promise<CheckoutResult> {
    const { uow, menu, clock, ids } = this.deps;
    const now = clock.now();

    const previous = await uow.run(({ orders }) => orders.findByIdempotencyKey(input.idempotencyKey));
    if (previous) return { order: previous.replayFor(input.cartId), replayed: true };

    // R9 บันทึกราคาที่ปรับแล้วแยกจาก transaction ของการยืนยัน เพื่อให้ลูกค้าเห็นยอดใหม่แม้ยืนยันไม่ผ่าน
    const { cart, items } = await uow.run(async ({ carts }) => {
      const cart = await requireCart(carts, input.cartId);
      const items = await menu.findByIds(menuItemIdsOf(cart));
      cart.reviewPrices(items, now);
      await carts.save(cart);
      return { cart, items };
    });

    // R10 ออกเลขคิวใน transaction เดียวกับการบันทึก ถ้าไม่สำเร็จเลขจะไม่ถูกใช้
    const order = await uow.run(async ({ carts, orders, queueNumbers }) => {
      const queueNumber = await queueNumbers.next(BusinessDay.of(now));
      const order = cart.checkout({ orderId: ids(), idempotencyKey: input.idempotencyKey, menu: items, queueNumber, now });
      await carts.save(cart);
      await orders.add(order);
      return order;
    });
    return { order, replayed: false };
  }
}
