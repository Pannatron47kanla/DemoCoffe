import type { Clock } from '../../../shared/clock';
import { requireCart, viewOf, type CartView } from './cart-view';
import type { MenuLookup, UnitOfWork } from './ports';

// UC-03 AC7: ตรวจว่าตะกร้าพร้อมไปหน้ายืนยัน แล้วคืนตะกร้า ไม่บันทึกและไม่สร้างออเดอร์ (R3)
export class CheckCartReadyForCheckout {
  constructor(private readonly deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock }) {}

  async execute(cartId: string): Promise<CartView> {
    const { uow, menu, clock } = this.deps;
    const cart = await uow.run(async ({ carts }) => {
      const cart = await requireCart(carts, cartId);
      cart.ensureReadyForCheckout(clock.now());
      return cart;
    });
    return viewOf(cart, menu);
  }
}
