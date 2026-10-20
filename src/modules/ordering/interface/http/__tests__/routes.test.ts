import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../../../../../../tests/support/openapi';
import { fixedClock } from '../../../../../shared/clock';
import { errorHandler } from '../../../../../shared/http-errors';
import { sequentialIds } from '../../../../../shared/ids';
import { FakeMenu, InMemoryOrdering } from '../../../application/__tests__/fakes';
import { americano, latte, matchaSoldOut, soldOut, withPrice } from '../../../domain/__tests__/menu-fixtures';
import { createOrderingModule } from '../../../module';

const MISSING = 'c0000000-0000-4000-8000-00000000dead';

describe('ordering HTTP routes', () => {
  let uow: InMemoryOrdering;
  let menu: FakeMenu;
  let clock: ReturnType<typeof fixedClock>;
  let app: express.Express;

  beforeEach(() => {
    uow = new InMemoryOrdering();
    menu = new FakeMenu([latte, americano, matchaSoldOut]);
    clock = fixedClock('2026-10-19T02:30:00Z');
    app = express();
    app.use(express.json());
    app.use(createOrderingModule({ uow, menu, clock, ids: sequentialIds() }).router);
    app.use(errorHandler);
  });

  async function newCart(): Promise<string> {
    return (await request(app).post('/carts')).body.id;
  }

  async function addLatte(cartId: string, quantity = 2) {
    return request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity });
  }

  async function expectError(res: request.Response, method: string, path: string, status: number, code: string) {
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expectMatchesSpec(method, path, res);
  }

  it('AC1: POST /carts ตอบ 201 ตะกร้าว่างตาม spec', async () => {
    const res = await request(app).post('/carts');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'OPEN', lines: [], totalCups: 0, total: { amount: '0.00', currency: 'THB' } });
    expect(res.body.expiresAt).toBe('2026-10-19T02:45:00.000Z');
    expectMatchesSpec('post', '/carts', res);
  });

  it('AC2: POST lines ตอบตะกร้าพร้อมชื่อ ตัวเลือก และราคาเป็นบาท', async () => {
    const res = await addLatte(await newCart());

    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual([
      {
        id: expect.any(String),
        menuItemId: 'latte',
        name: 'ลาเต้',
        options: [
          { choiceId: 'size-l', groupName: 'ขนาด', name: 'L', priceDelta: { amount: '10.00', currency: 'THB' } },
          { choiceId: 'milk-oat', groupName: 'นม', name: 'นมโอ๊ต', priceDelta: { amount: '15.00', currency: 'THB' } },
        ],
        quantity: 2,
        unitPrice: { amount: '80.00', currency: 'THB' },
        lineTotal: { amount: '160.00', currency: 'THB' },
      },
    ]);
    expect(res.body.total).toEqual({ amount: '160.00', currency: 'THB' });
    expectMatchesSpec('post', '/carts/{cartId}/lines', res);
  });

  it('AC2: GET /carts/{cartId} ตอบตะกร้าล่าสุด', async () => {
    const cartId = await newCart();
    await addLatte(cartId);

    const res = await request(app).get(`/carts/${cartId}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCups).toBe(2);
    expectMatchesSpec('get', '/carts/{cartId}', res);
  });

  it('AC3: เพิ่มชุดเดิมซ้ำ รวมเป็นรายการเดียว', async () => {
    const cartId = await newCart();
    await addLatte(cartId, 2);

    const res = await addLatte(cartId, 1);

    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].quantity).toBe(3);
  });

  it('AC4: PATCH แก้จำนวน', async () => {
    const cartId = await newCart();
    const lineId = (await addLatte(cartId)).body.lines[0].id;

    const res = await request(app).patch(`/carts/${cartId}/lines/${lineId}`).send({ quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.total.amount).toBe('320.00');
    expectMatchesSpec('patch', '/carts/{cartId}/lines/{lineId}', res);
  });

  it('AC5: DELETE ลบรายการ', async () => {
    const cartId = await newCart();
    const lineId = (await addLatte(cartId)).body.lines[0].id;

    const res = await request(app).delete(`/carts/${cartId}/lines/${lineId}`);

    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual([]);
    expectMatchesSpec('delete', '/carts/{cartId}/lines/{lineId}', res);
  });

  describe('AC6: ข้อมูลผิดรูปแบบตอบ 400 VALIDATION_ERROR', () => {
    it.each([
      ['ไม่ส่ง menuItemId', { quantity: 2 }, ['menuItemId']],
      ['menuItemId ว่าง', { menuItemId: '', quantity: 2 }, ['menuItemId']],
      ['quantity ไม่ใช่จำนวนเต็ม', { menuItemId: 'latte', quantity: 1.5 }, ['quantity']],
      ['quantity เป็นข้อความ', { menuItemId: 'latte', quantity: '2' }, ['quantity']],
      ['optionChoiceIds ไม่ใช่ array ของข้อความ', { menuItemId: 'latte', optionChoiceIds: 'size-m', quantity: 1 }, ['optionChoiceIds']],
    ])('AC6: POST lines %s', async (_case, body, fields) => {
      const res = await request(app).post(`/carts/${await newCart()}/lines`).send(body);

      await expectError(res, 'post', '/carts/{cartId}/lines', 400, 'VALIDATION_ERROR');
      expect(res.body.details.fields).toEqual(fields);
    });

    it('AC6: PATCH quantity ไม่ใช่จำนวนเต็ม', async () => {
      const cartId = await newCart();
      const lineId = (await addLatte(cartId)).body.lines[0].id;

      const res = await request(app).patch(`/carts/${cartId}/lines/${lineId}`).send({ quantity: 'four' });

      await expectError(res, 'patch', '/carts/{cartId}/lines/{lineId}', 400, 'VALIDATION_ERROR');
    });

    it('AC6: JSON เสีย', async () => {
      const res = await request(app).post(`/carts/${await newCart()}/lines`).set('content-type', 'application/json').send('{"menuItemId":');

      await expectError(res, 'post', '/carts/{cartId}/lines', 400, 'VALIDATION_ERROR');
    });

    it('AC6: ยืนยันโดยไม่แนบ Idempotency-Key', async () => {
      const cartId = await newCart();
      await addLatte(cartId);

      const res = await request(app).post(`/carts/${cartId}/checkout`);

      await expectError(res, 'post', '/carts/{cartId}/checkout', 400, 'VALIDATION_ERROR');
      expect(res.body.details.fields).toEqual(['Idempotency-Key']);
    });
  });

  it('AC7: เมนูที่ไม่มีตอบ 404 MENU_ITEM_NOT_FOUND', async () => {
    const res = await request(app).post(`/carts/${await newCart()}/lines`).send({ menuItemId: 'unicorn-frappe', quantity: 1 });

    await expectError(res, 'post', '/carts/{cartId}/lines', 404, 'MENU_ITEM_NOT_FOUND');
  });

  it.each([
    ['AC8', 'MENU_ITEM_UNAVAILABLE', { menuItemId: 'matcha-latte', optionChoiceIds: ['size-m'], quantity: 1 }],
    ['AC9', 'OPTION_REQUIRED', { menuItemId: 'latte', optionChoiceIds: [], quantity: 1 }],
    ['AC10', 'INVALID_OPTION', { menuItemId: 'latte', optionChoiceIds: ['size-m', 'whip-cream'], quantity: 1 }],
    ['AC11', 'QUANTITY_OUT_OF_RANGE', { menuItemId: 'latte', optionChoiceIds: ['size-m'], quantity: 11 }],
  ])('%s: ผิดกฎตะกร้าตอบ 409 %s', async (_ac, code, body) => {
    const res = await request(app).post(`/carts/${await newCart()}/lines`).send(body);

    await expectError(res, 'post', '/carts/{cartId}/lines', 409, code);
  });

  it('AC12: ตะกร้าเกิน 20 แก้วตอบ 409 CART_LIMIT_REACHED', async () => {
    const cartId = await newCart();
    await addLatte(cartId, 10);
    await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'americano', optionChoiceIds: ['size-m'], quantity: 8 });

    const res = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'americano', optionChoiceIds: ['size-l'], quantity: 3 });

    await expectError(res, 'post', '/carts/{cartId}/lines', 409, 'CART_LIMIT_REACHED');
  });

  it('AC13: ตะกร้าหรือรายการที่ไม่มีตอบ 404', async () => {
    const cartId = await newCart();

    await expectError(await request(app).get(`/carts/${MISSING}`), 'get', '/carts/{cartId}', 404, 'CART_NOT_FOUND');
    await expectError(await request(app).get('/carts/not-a-uuid'), 'get', '/carts/{cartId}', 404, 'CART_NOT_FOUND');
    await expectError(
      await request(app).delete(`/carts/${cartId}/lines/${MISSING}`), 'delete', '/carts/{cartId}/lines/{lineId}', 404, 'CART_LINE_NOT_FOUND',
    );
    await expectError(
      await request(app).post(`/carts/${MISSING}/checkout`).set('Idempotency-Key', 'k-1'), 'post', '/carts/{cartId}/checkout', 404, 'CART_NOT_FOUND',
    );
  });

  it('AC14: ตะกร้าหมดอายุตอบ 409 CART_EXPIRED', async () => {
    const cartId = await newCart();
    clock.advance(15 * 60_000);

    await expectError(await addLatte(cartId), 'post', '/carts/{cartId}/lines', 409, 'CART_EXPIRED');
  });

  describe('GET /orders/{orderId}', () => {
    it('AC2: GET /orders/{orderId} ตอบคิว รายการ ยอด ไม่มี cartId', async () => {
      const cartId = await newCart();
      await addLatte(cartId);
      const placed = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-123');

      const res = await request(app).get(`/orders/${placed.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: placed.body.id, queueNumber: 1, total: { amount: '160.00', currency: 'THB' } });
      expect(res.body).not.toHaveProperty('cartId');
      expect(res.body).not.toHaveProperty('statusPageUrl');
      expectMatchesSpec('get', '/orders/{orderId}', res);
    });
  });

  describe('POST /carts/{cartId}/checkout', () => {
    const checkout = (cartId: string, key = 'k-123') => request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', key);

    it('AC15: ยืนยันได้ 201 ออเดอร์ PLACED คิว 1 ตาม spec', async () => {
      const cartId = await newCart();
      await addLatte(cartId);

      const res = await checkout(cartId);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ cartId, status: 'PLACED', queueNumber: 1, total: { amount: '160.00', currency: 'THB' } });
      expect(res.body.lines[0]).toMatchObject({ name: 'ลาเต้', quantity: 2, unitPrice: { amount: '80.00' } });
      expectMatchesSpec('post', '/carts/{cartId}/checkout', res);
    });

    it('AC18: ยืนยันซ้ำด้วย key เดิมตอบ 200 ออเดอร์เดิม', async () => {
      const cartId = await newCart();
      await addLatte(cartId);
      const first = await checkout(cartId);

      const again = await checkout(cartId);

      expect(again.status).toBe(200);
      expect(again.body).toEqual(first.body);
      expectMatchesSpec('post', '/carts/{cartId}/checkout', again);
    });

    it('AC19: ตะกร้ายืนยันแล้ว key ใหม่ตอบ 409 CART_ALREADY_CHECKED_OUT', async () => {
      const cartId = await newCart();
      await addLatte(cartId);
      await checkout(cartId);

      await expectError(await checkout(cartId, 'k-new'), 'post', '/carts/{cartId}/checkout', 409, 'CART_ALREADY_CHECKED_OUT');
      await expectError(await addLatte(cartId), 'post', '/carts/{cartId}/lines', 409, 'CART_ALREADY_CHECKED_OUT');
    });

    it('AC20: ตะกร้าว่างตอบ 409 CART_EMPTY', async () => {
      await expectError(await checkout(await newCart()), 'post', '/carts/{cartId}/checkout', 409, 'CART_EMPTY');
    });

    it('AC21: เมนูหมดภายหลังตอบ 409 MENU_ITEM_UNAVAILABLE พร้อม lineIds', async () => {
      const cartId = await newCart();
      const lineId = (await addLatte(cartId)).body.lines[0].id;
      menu.items = [soldOut(latte), americano];

      const res = await checkout(cartId);

      await expectError(res, 'post', '/carts/{cartId}/checkout', 409, 'MENU_ITEM_UNAVAILABLE');
      expect(res.body.details.lineIds).toEqual([lineId]);
    });

    it('AC22: ราคาเปลี่ยนตอบ 409 PRICE_CHANGED พร้อมตะกร้าที่คิดราคาใหม่ แล้วยืนยันอีกครั้งได้', async () => {
      const cartId = await newCart();
      await addLatte(cartId);
      menu.items = [withPrice(latte, 6000), americano];

      const res = await checkout(cartId, 'k-1');

      await expectError(res, 'post', '/carts/{cartId}/checkout', 409, 'PRICE_CHANGED');
      expect(res.body.details.cart.total).toEqual({ amount: '170.00', currency: 'THB' });

      const retry = await checkout(cartId, 'k-2');
      expect(retry.status).toBe(201);
      expect(retry.body.total.amount).toBe('170.00');
    });

    it('AC25: key ที่ใช้กับตะกร้าอื่นแล้วตอบ 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
      const cartA = await newCart();
      const cartB = await newCart();
      await addLatte(cartA);
      await addLatte(cartB);
      await checkout(cartA, 'k-123');

      await expectError(await checkout(cartB, 'k-123'), 'post', '/carts/{cartId}/checkout', 409, 'IDEMPOTENCY_KEY_CONFLICT');
    });
  });
});
