import { requireCart, viewOf, type CartView } from './cart-view';
import type { MenuLookup, UnitOfWork } from './ports';

export class GetCart {
  constructor(private readonly deps: { uow: UnitOfWork; menu: MenuLookup }) {}

  async execute(cartId: string): Promise<CartView> {
    const cart = await this.deps.uow.run(({ carts }) => requireCart(carts, cartId));
    return viewOf(cart, this.deps.menu);
  }
}
