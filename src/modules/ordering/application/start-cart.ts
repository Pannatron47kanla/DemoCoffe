import type { Clock } from '../../../shared/clock';
import type { IdGenerator } from '../../../shared/ids';
import { Cart } from '../domain/cart';
import type { CartView } from './cart-view';
import type { UnitOfWork } from './ports';

// UC-01 ขั้นที่ 1: ลูกค้าเริ่มสั่ง
export class StartCart {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock; ids: IdGenerator }) {}

  async execute(): Promise<CartView> {
    const cart = Cart.start(this.deps.ids(), this.deps.clock.now());
    await this.deps.uow.run(({ carts }) => carts.save(cart));
    return { cart, items: [] };
  }
}
