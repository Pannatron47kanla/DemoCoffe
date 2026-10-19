import type { BusinessDay } from '../../domain/business-day';
import { Cart, type CartState } from '../../domain/cart';
import { Order, type OrderState } from '../../domain/order';
import type { OrderableItem } from '../../domain/orderable-item';
import { QueueNumber } from '../../domain/queue-number';
import type { MenuLookup, OrderingRepositories, UnitOfWork } from '../ports';

// เก็บเป็น state แล้ว restore ใหม่ทุกครั้ง เหมือนอ่านจาก DB จริง
export class InMemoryOrdering implements UnitOfWork {
  readonly carts = new Map<string, CartState>();
  readonly orders = new Map<string, OrderState>();
  readonly counters = new Map<string, number>();

  async run<T>(work: (repos: OrderingRepositories) => Promise<T>): Promise<T> {
    return work({
      carts: {
        findById: async (id) => (this.carts.has(id) ? Cart.restore(structuredClone(this.carts.get(id)!)) : null),
        save: async (cart) => void this.carts.set(cart.id, structuredClone(cart.toState())),
      },
      orders: {
        findByIdempotencyKey: async (key) => {
          const state = [...this.orders.values()].find((o) => o.idempotencyKey === key);
          return state ? Order.restore(structuredClone(state)) : null;
        },
        add: async (order) => void this.orders.set(order.id, structuredClone(order.toState())),
      },
      queueNumbers: {
        next: async (day: BusinessDay) => {
          const next = (this.counters.get(day.value) ?? 0) + 1;
          this.counters.set(day.value, next);
          return QueueNumber.of(next);
        },
      },
    });
  }

  cart(id: string): Cart {
    return Cart.restore(structuredClone(this.carts.get(id)!));
  }
}

export class FakeMenu implements MenuLookup {
  constructor(public items: OrderableItem[]) {}

  async findByIds(ids: readonly string[]) {
    return this.items.filter((item) => ids.includes(item.id));
  }
}
