import { requireCart } from './cart-view';
import type { UnitOfWork } from './ports';

// ให้ context อื่นถามว่าตะกร้ายังรับงานต่อได้ไหม; ตอนนี้แค่โหลดตะกร้า (AC6–AC8 เพิ่มการตรวจ)
export class CheckCartAvailability {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  async assertOpen(cartId: string): Promise<void> {
    await this.deps.uow.run(({ carts }) => requireCart(carts, cartId));
  }
}
