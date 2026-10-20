import type { Clock } from '../../../shared/clock';
import { requireCart } from './cart-view';
import type { UnitOfWork } from './ports';

// ให้ context อื่นถามว่าตะกร้ายังรับงานต่อได้ไหม; ตรวจว่ามีตะกร้า (AC6) แล้วให้ตะกร้าตัดสินเองว่าหมดอายุ (R8, AC7) หรือยืนยันแล้ว (R7, AC8)
export class CheckCartAvailability {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock }) {}

  async assertOpen(cartId: string): Promise<void> {
    await this.deps.uow.run(async ({ carts }) => {
      const cart = await requireCart(carts, cartId);
      cart.ensureOpen(this.deps.clock.now());
    });
  }
}
