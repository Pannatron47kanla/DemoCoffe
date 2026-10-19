import type { DbClient } from '../../../shared/db';
import { Cart, type CartStatus } from '../domain/cart';
import type { CartRepository } from '../domain/repositories';

export class PgCartRepository implements CartRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<Cart | null> {
    const { rows: [cart] } = await this.db.query<{ id: string; status: CartStatus; last_activity_at: Date }>(
      'SELECT id, status, last_activity_at FROM carts WHERE id = $1',
      [id],
    );
    if (!cart) return null;

    const { rows: lines } = await this.db.query<{
      id: string; menu_item_id: string; option_choice_ids: string[]; quantity: number; unit_price_satang: number;
    }>(
      `SELECT id, menu_item_id, option_choice_ids, quantity, unit_price_satang
         FROM cart_lines WHERE cart_id = $1 ORDER BY created_at, id`,
      [id],
    );

    return Cart.restore({
      id: cart.id,
      status: cart.status,
      lastActivityAt: cart.last_activity_at,
      lines: lines.map((l) => ({
        id: l.id,
        menuItemId: l.menu_item_id,
        optionChoiceIds: l.option_choice_ids,
        quantity: l.quantity,
        unitPriceSatang: l.unit_price_satang,
      })),
    });
  }

  async save(cart: Cart): Promise<void> {
    const state = cart.toState();
    await this.db.query(
      `INSERT INTO carts (id, status, last_activity_at) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET status = $2, last_activity_at = $3, updated_at = now()`,
      [state.id, state.status, state.lastActivityAt],
    );
    // ลบรายการที่ไม่อยู่ในตะกร้าแล้วก่อน เพื่อไม่ชน UNIQUE (cart_id, menu_item_id, option_choice_ids)
    await this.db.query('DELETE FROM cart_lines WHERE cart_id = $1 AND NOT (id = ANY($2::uuid[]))', [
      state.id,
      state.lines.map((l) => l.id),
    ]);
    for (const line of state.lines) {
      await this.db.query(
        `INSERT INTO cart_lines (id, cart_id, menu_item_id, option_choice_ids, quantity, unit_price_satang)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET quantity = $5, unit_price_satang = $6, updated_at = now()`,
        [line.id, state.id, line.menuItemId, line.optionChoiceIds, line.quantity, line.unitPriceSatang],
      );
    }
  }
}
