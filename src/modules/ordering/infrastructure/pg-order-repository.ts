import { randomUUID } from 'node:crypto';
import { isUniqueViolation, type DbClient } from '../../../shared/db';
import { DomainError } from '../../../shared/domain-error';
import { Order, type OrderLineOption, type OrderStatus } from '../domain/order';
import type { OrderRepository } from '../domain/repositories';

export class PgOrderRepository implements OrderRepository {
  constructor(private readonly db: DbClient) {}

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const { rows: [order] } = await this.db.query<{
      id: string; cart_id: string; idempotency_key: string; status: OrderStatus;
      business_day: string; queue_number: number; placed_at: Date;
    }>(
      `SELECT id, cart_id, idempotency_key, status, business_day, queue_number, placed_at
         FROM orders WHERE idempotency_key = $1`,
      [key],
    );
    if (!order) return null;

    const { rows: lines } = await this.db.query<{
      menu_item_id: string; menu_item_name: string; options: OrderLineOption[]; quantity: number; unit_price_satang: number;
    }>(
      `SELECT menu_item_id, menu_item_name, options, quantity, unit_price_satang
         FROM order_lines WHERE order_id = $1 ORDER BY position`,
      [order.id],
    );

    return Order.restore({
      id: order.id,
      cartId: order.cart_id,
      idempotencyKey: order.idempotency_key,
      status: order.status,
      businessDay: order.business_day,
      queueNumber: order.queue_number,
      placedAt: order.placed_at,
      lines: lines.map((l) => ({
        menuItemId: l.menu_item_id,
        name: l.menu_item_name,
        options: l.options,
        quantity: l.quantity,
        unitPriceSatang: l.unit_price_satang,
      })),
    });
  }

  async add(order: Order): Promise<void> {
    const state = order.toState();
    try {
      await this.db.query(
        `INSERT INTO orders (id, cart_id, idempotency_key, status, business_day, queue_number, placed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [state.id, state.cartId, state.idempotencyKey, state.status, state.businessDay, state.queueNumber, state.placedAt],
      );
    } catch (error) {
      // R8, R11 กรณียืนยันพร้อมกันจนหลุดการตรวจใน domain
      if (isUniqueViolation(error, 'orders_cart_id_key')) throw new DomainError('CART_ALREADY_CHECKED_OUT');
      if (isUniqueViolation(error, 'orders_idempotency_key_key')) throw new DomainError('IDEMPOTENCY_KEY_CONFLICT');
      throw error;
    }
    for (const [index, line] of state.lines.entries()) {
      await this.db.query(
        `INSERT INTO order_lines (id, order_id, position, menu_item_id, menu_item_name, options, quantity, unit_price_satang)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), state.id, index + 1, line.menuItemId, line.name, JSON.stringify(line.options), line.quantity, line.unitPriceSatang],
      );
    }
  }
}
