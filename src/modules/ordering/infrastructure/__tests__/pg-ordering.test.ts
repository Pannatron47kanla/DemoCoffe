import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../../../../tests/support/postgres';
import { DomainError } from '../../../../shared/domain-error';
import { americano, latte } from '../../domain/__tests__/menu-fixtures';
import { BusinessDay } from '../../domain/business-day';
import { Cart } from '../../domain/cart';
import type { Order } from '../../domain/order';
import { QueueNumber } from '../../domain/queue-number';
import { PgUnitOfWork } from '../pg-unit-of-work';

const T0 = new Date('2026-10-19T02:30:00Z');
const DAY = BusinessDay.of(T0); // 2026-10-19
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: TestDatabase;
let uow: PgUnitOfWork;

beforeAll(async () => {
  db = await startTestDatabase();
  uow = new PgUnitOfWork(db.pool);
});
afterAll(() => db?.stop());
beforeEach(() => db.reset());

function cartWithLattes(cartId: string, quantity = 2) {
  const cart = Cart.start(cartId, T0);
  cart.addLine({ lineId: id(900 + Number(cartId.slice(-3))), item: latte, optionChoiceIds: ['size-l', 'milk-oat'], quantity }, T0);
  return cart;
}

async function placeOrder(cart: Cart, orderId: string, idempotencyKey: string, queueNumber = 1): Promise<Order> {
  const order = cart.checkout({ orderId, idempotencyKey, menu: [latte, americano], queueNumber: QueueNumber.of(queueNumber), now: T0 });
  await uow.run(async ({ carts, orders }) => {
    await carts.save(cart);
    await orders.add(order);
  });
  return order;
}

async function domainErrorOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  return (error as DomainError).code;
}

describe('PgCartRepository', () => {
  it('AC1: บันทึกและโหลดตะกร้าว่าง', async () => {
    const cart = Cart.start(id(1), T0);

    await uow.run(({ carts }) => carts.save(cart));
    const loaded = await uow.run(({ carts }) => carts.findById(id(1)));

    expect(loaded?.toState()).toEqual(cart.toState());
  });

  it('AC2: บันทึกและโหลดตะกร้าที่มีรายการ ราคา และตัวเลือก', async () => {
    const cart = cartWithLattes(id(2));

    await uow.run(({ carts }) => carts.save(cart));
    const loaded = await uow.run(({ carts }) => carts.findById(id(2)));

    expect(loaded?.toState()).toEqual(cart.toState());
    expect(loaded?.lines[0]?.optionChoiceIds).toEqual(['milk-oat', 'size-l']);
    expect(loaded?.total.satang).toBe(16000);
  });

  it('AC3/AC4: บันทึกซ้ำหลังเปลี่ยนจำนวน อัปเดตแถวเดิม', async () => {
    const cart = cartWithLattes(id(3));
    await uow.run(({ carts }) => carts.save(cart));

    cart.addLine({ lineId: id(99), item: latte, optionChoiceIds: ['milk-oat', 'size-l'], quantity: 1 }, T0);
    cart.addLine({ lineId: id(98), item: americano, optionChoiceIds: ['size-m'], quantity: 1 }, T0);
    await uow.run(({ carts }) => carts.save(cart));
    const loaded = await uow.run(({ carts }) => carts.findById(id(3)));

    expect(loaded?.lines.map((l) => [l.menuItemId, l.quantity])).toEqual([['latte', 3], ['americano', 1]]);
  });

  it('AC5: บันทึกหลังลบรายการ ลบแถวออก', async () => {
    const cart = cartWithLattes(id(4));
    await uow.run(({ carts }) => carts.save(cart));

    cart.removeLine(cart.lines[0]!.id, T0);
    await uow.run(({ carts }) => carts.save(cart));
    const loaded = await uow.run(({ carts }) => carts.findById(id(4)));

    expect(loaded?.lines).toEqual([]);
  });

  it('AC13: ไม่มีตะกร้า คืน null', async () => {
    expect(await uow.run(({ carts }) => carts.findById(id(404)))).toBeNull();
  });

  it('AC11: DB กันจำนวนนอกช่วง 1–10', async () => {
    await uow.run(({ carts }) => carts.save(Cart.start(id(5), T0)));

    await expect(
      db.pool.query(
        `INSERT INTO cart_lines (id, cart_id, menu_item_id, quantity, unit_price_satang) VALUES ($1, $2, 'latte', 11, 5500)`,
        [id(55), id(5)],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('PgOrderRepository', () => {
  it('AC15/AC24: บันทึกและโหลดออเดอร์พร้อม snapshot ชื่อ ตัวเลือก ราคา', async () => {
    const cart = cartWithLattes(id(10));
    cart.addLine({ lineId: id(11), item: americano, optionChoiceIds: ['size-m'], quantity: 1 }, T0);
    const order = await placeOrder(cart, id(100), 'k-123');

    const loaded = await uow.run(({ orders }) => orders.findByIdempotencyKey('k-123'));

    expect(loaded?.toState()).toEqual(order.toState());
    expect(loaded?.total.satang).toBe(21000);
    expect(loaded?.businessDay.value).toBe('2026-10-19');
  });

  it('AC2: findById คืนออเดอร์พร้อมรายการตามลำดับ', async () => {
    const cart = cartWithLattes(id(40));
    cart.addLine({ lineId: id(41), item: americano, optionChoiceIds: ['size-m'], quantity: 1 }, T0);
    const order = await placeOrder(cart, id(400), 'k-find');

    const loaded = await uow.run(({ orders }) => orders.findById(order.id));

    expect(loaded?.toState()).toEqual(order.toState());
    expect(await uow.run(({ orders }) => orders.findById(id(999)))).toBeNull();
  });

  it('AC18: ไม่มี key คืน null', async () => {
    expect(await uow.run(({ orders }) => orders.findByIdempotencyKey('k-none'))).toBeNull();
  });

  it('AC19: ตะกร้าเดียวได้ออเดอร์เดียว ซ้อนกันตอบ CART_ALREADY_CHECKED_OUT', async () => {
    const order = await placeOrder(cartWithLattes(id(20)), id(200), 'k-1');
    const duplicate = cartWithLattes(id(20)).checkout({
      orderId: id(201), idempotencyKey: 'k-2', menu: [latte], queueNumber: QueueNumber.of(2), now: T0,
    });

    expect(await domainErrorOf(uow.run(({ orders }) => orders.add(duplicate)))).toBe('CART_ALREADY_CHECKED_OUT');
    expect(order.id).toBe(id(200));
  });

  it('AC25: key เดียวกันกับตะกร้าอื่นตอบ IDEMPOTENCY_KEY_CONFLICT', async () => {
    await placeOrder(cartWithLattes(id(30)), id(300), 'k-123');
    const other = cartWithLattes(id(31));
    await uow.run(({ carts }) => carts.save(other));
    const conflicting = other.checkout({
      orderId: id(301), idempotencyKey: 'k-123', menu: [latte], queueNumber: QueueNumber.of(2), now: T0,
    });

    expect(await domainErrorOf(uow.run(({ orders }) => orders.add(conflicting)))).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });
});

describe('PgQueueNumberSequence', () => {
  it('AC15: วันที่ยังไม่มีออเดอร์ได้เลข 1 แล้วเรียงต่อ', async () => {
    const first = await uow.run(({ queueNumbers }) => queueNumbers.next(DAY));
    const second = await uow.run(({ queueNumbers }) => queueNumbers.next(DAY));

    expect([first.value, second.value]).toEqual([1, 2]);
  });

  it('AC16: วันนี้ออกไปแล้ว 41 ใบ ได้เลข 42', async () => {
    await db.pool.query(`INSERT INTO queue_counters (business_day, last_number) VALUES ('2026-10-19', 41)`);

    expect((await uow.run(({ queueNumbers }) => queueNumbers.next(DAY))).value).toBe(42);
  });

  it('AC17: วันใหม่เริ่มที่ 1 ไม่ต่อจากเมื่อวาน', async () => {
    await db.pool.query(`INSERT INTO queue_counters (business_day, last_number) VALUES ('2026-10-19', 87)`);

    const next = await uow.run(({ queueNumbers }) => queueNumbers.next(BusinessDay.restore('2026-10-20')));

    expect(next.value).toBe(1);
  });

  it('AC16: ยืนยันไม่สำเร็จ (transaction rollback) เลขคิวไม่ถูกใช้', async () => {
    await uow.run(({ queueNumbers }) => queueNumbers.next(DAY));

    await uow
      .run(async ({ queueNumbers }) => {
        await queueNumbers.next(DAY);
        throw new DomainError('PRICE_CHANGED');
      })
      .catch(() => undefined);

    expect((await uow.run(({ queueNumbers }) => queueNumbers.next(DAY))).value).toBe(2);
  });

  it('AC23: ยืนยันพร้อมกัน 10 ตะกร้า ได้เลข 1–10 ไม่ซ้ำ', async () => {
    const carts = Array.from({ length: 10 }, (_, i) => cartWithLattes(id(500 + i)));
    await uow.run(async (repos) => {
      for (const cart of carts) await repos.carts.save(cart);
    });

    const numbers = await Promise.all(
      carts.map((cart, i) =>
        uow.run(async ({ carts: cartRepo, orders, queueNumbers }) => {
          const queueNumber = await queueNumbers.next(DAY);
          const order = cart.checkout({ orderId: id(600 + i), idempotencyKey: `k-${i}`, menu: [latte], queueNumber, now: T0 });
          await cartRepo.save(cart);
          await orders.add(order);
          return queueNumber.value;
        }),
      ),
    );

    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
