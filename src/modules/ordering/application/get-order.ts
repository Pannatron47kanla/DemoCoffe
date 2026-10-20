import { DomainError } from '../../../shared/domain-error';
import type { Order } from '../domain/order';
import type { UnitOfWork } from './ports';

// หน้าสถานะบนมือถืออ่านออเดอร์จากรหัสใน QR
export class GetOrder {
  constructor(private readonly deps: { uow: UnitOfWork }) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.deps.uow.run(({ orders }) => orders.findById(orderId));
    if (!order) throw new DomainError('ORDER_NOT_FOUND');
    return order;
  }
}
