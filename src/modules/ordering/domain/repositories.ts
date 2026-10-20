import type { BusinessDay } from './business-day';
import type { Cart } from './cart';
import type { Order } from './order';
import type { QueueNumber } from './queue-number';

export interface CartRepository {
  findById(id: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByIdempotencyKey(key: string): Promise<Order | null>;
  add(order: Order): Promise<void>;
}

// R10 ออกเลขถัดไปของวันทำการ ต้องเรียกใน transaction เดียวกับการบันทึกออเดอร์ เพื่อไม่ให้เลขข้ามเมื่อยืนยันไม่สำเร็จ
export interface QueueNumberSequence {
  next(day: BusinessDay): Promise<QueueNumber>;
}
