import type { Clock } from '../../../shared/clock';
import { requireCart } from './cart-view';
import type { UnitOfWork } from './ports';

// ให้ context อื่นถามว่าตะกร้ายังรับงานต่อได้ไหม; ตอนนี้ตรวจว่ามีตะกร้า (AC7–AC8 เพิ่มการตรวจสถานะ)
export class CheckCartAvailability {
  constructor(private readonly deps: { uow: UnitOfWork; clock: Clock }) {}

  async assertOpen(cartId: string): Promise<void> {
    await this.deps.uow.run(({ carts }) => requireCart(carts, cartId));
  }
}
