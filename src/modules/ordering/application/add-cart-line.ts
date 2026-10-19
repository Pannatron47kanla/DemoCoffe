import type { Clock } from '../../../shared/clock';
import { DomainError } from '../../../shared/domain-error';
import type { IdGenerator } from '../../../shared/ids';
import { requireCart, viewOf, type CartView } from './cart-view';
import type { MenuLookup, UnitOfWork } from './ports';

export interface AddCartLineInput {
  cartId: string;
  menuItemId: string;
  optionChoiceIds: readonly string[];
  quantity: number;
}

// UC-01 ขั้นที่ 2: เลือกเมนู ตัวเลือก และจำนวน แล้วเพิ่มลงตะกร้า
export class AddCartLine {
  constructor(private readonly deps: { uow: UnitOfWork; menu: MenuLookup; clock: Clock; ids: IdGenerator }) {}

  async execute(input: AddCartLineInput): Promise<CartView> {
    const { uow, menu, clock, ids } = this.deps;
    const cart = await uow.run(async ({ carts }) => {
      const cart = await requireCart(carts, input.cartId);
      const [item] = await menu.findByIds([input.menuItemId]);
      if (!item) throw new DomainError('MENU_ITEM_NOT_FOUND');

      cart.addLine({ lineId: ids(), item, optionChoiceIds: input.optionChoiceIds, quantity: input.quantity }, clock.now());
      await carts.save(cart);
      return cart;
    });
    return viewOf(cart, menu);
  }
}
