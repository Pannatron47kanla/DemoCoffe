import type { OrderableItem } from '../domain/orderable-item';
import type { CartRepository, OrderRepository, QueueNumberSequence } from '../domain/repositories';

// สิ่งที่ ordering ต้องการจาก context menu (main.ts ส่งของจริงเข้ามา)
export interface MenuLookup {
  /** คืนเฉพาะเมนูที่มีอยู่ id ที่ไม่มีจะไม่อยู่ในผลลัพธ์ */
  findByIds(ids: readonly string[]): Promise<OrderableItem[]>;
}

export interface OrderingRepositories {
  carts: CartRepository;
  orders: OrderRepository;
  queueNumbers: QueueNumberSequence;
}

export interface UnitOfWork {
  run<T>(work: (repos: OrderingRepositories) => Promise<T>): Promise<T>;
}
