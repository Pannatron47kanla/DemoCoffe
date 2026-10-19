import type { Clock } from '../../../shared/clock';
import { requireCart, viewOf, type CartView } from './cart-view';
import type { MenuLookup, UnitOfWork } from './ports';

// UC-01 ขั้นที่ 3: ลบรายการ
export class RemoveCartLine {
  constructor(private readonly deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock }) {}

  async execute(input: { cartId: string; lineId: string }): Promise<CartView> {
    const { uow, menu, clock } = this.deps;
    const cart = await uow.run(async ({ carts }) => {
      const cart = await requireCart(carts, input.cartId);
      cart.removeLine(input.lineId, clock.now());
      await carts.save(cart);
      return cart;
    });
    return viewOf(cart, menu);
  }
}
