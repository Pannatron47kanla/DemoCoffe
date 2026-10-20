import { join } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { unavailableVoiceGateway } from '../../src/modules/voice';
import { fixedClock } from '../../src/shared/clock';
import { randomIds } from '../../src/shared/ids';
import { expectMatchesSpec } from '../support/openapi';
import { startTestDatabase, type TestDatabase } from '../support/postgres';

// UC-01 ครบ flow ผ่าน HTTP กับ Postgres จริงและ data/menu.json จริง
describe('UC-01 สั่งเครื่องดื่มที่ตู้ (e2e)', () => {
  let db: TestDatabase;
  let app: Express;
  const clock = fixedClock('2026-10-19T02:30:00Z');

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({
      pool: db.pool,
      menuPath: join(import.meta.dirname, '../../data/menu.json'),
       clock,
      ids: randomIds,
      voice: { gateway: unavailableVoiceGateway, consentPath: join(import.meta.dirname, '../../data/voice-consent.json'), kioskId: 'kiosk-1' },
    });
  });
  afterAll(() => db?.stop());
  beforeEach(async () => {
    await db.reset();
    clock.set('2026-10-19T02:30:00Z');
  });

  it('AC1–AC5, AC15, AC18: เริ่มสั่ง → เพิ่ม → รวมซ้ำ → แก้จำนวน → ลบ → ยืนยัน → ยืนยันซ้ำ', async () => {
    const started = await request(app).post('/carts');
    expect(started.status).toBe(201);
    const cartId = started.body.id;

    const latte = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 });
    expect(latte.body.total.amount).toBe('160.00');
    expectMatchesSpec('post', '/carts/{cartId}/lines', latte);

    const merged = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['milk-oat', 'size-l'], quantity: 1 });
    expect(merged.body.lines).toHaveLength(1);
    expect(merged.body.lines[0].quantity).toBe(3);

    const espresso = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'espresso', quantity: 1 });
    const espressoLineId = espresso.body.lines[1].id;
    await request(app).patch(`/carts/${cartId}/lines/${espressoLineId}`).send({ quantity: 2 }).expect(200);
    const removed = await request(app).delete(`/carts/${cartId}/lines/${espressoLineId}`).expect(200);
    expect(removed.body.total.amount).toBe('240.00');

    const placed = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-e2e-1');
    expect(placed.status).toBe(201);
    expect(placed.body).toMatchObject({ status: 'PLACED', queueNumber: 1, total: { amount: '240.00' } });
    expectMatchesSpec('post', '/carts/{cartId}/checkout', placed);

    const replay = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-e2e-1');
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(placed.body);

    const reloaded = await request(app).get(`/carts/${cartId}`);
    expect(reloaded.body.status).toBe('CHECKED_OUT');
  });

  it('AC14: ตะกร้าไม่แตะ 15 นาทีหมดอายุ (เวลาจาก clock ที่ inject)', async () => {
    const cartId = (await request(app).post('/carts')).body.id;
    clock.advance(15 * 60_000);

    const res = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'espresso', quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_EXPIRED');
  });

  it('AC16, AC17, AC23: ยืนยัน 8 ตะกร้าพร้อมกันได้คิว 1–8 วันถัดไปเริ่มที่ 1', async () => {
    const cartIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const cartId = (await request(app).post('/carts')).body.id;
      await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'espresso', quantity: 1 }).expect(200);
      cartIds.push(cartId);
    }

    const results = await Promise.all(
      cartIds.map((cartId, i) => request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', `k-par-${i}`)),
    );

    expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
    expect(results.map((r) => r.body.queueNumber).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    clock.set('2026-10-19T17:00:00Z'); // 00:00 ของวันถัดไป Asia/Bangkok
    const nextDayCart = (await request(app).post('/carts')).body.id;
    await request(app).post(`/carts/${nextDayCart}/lines`).send({ menuItemId: 'espresso', quantity: 1 });
    const firstOfDay = await request(app).post(`/carts/${nextDayCart}/checkout`).set('Idempotency-Key', 'k-next-day');
    expect(firstOfDay.body.queueNumber).toBe(1);
  });

  it('AC8: เมนูที่ menu.json ตั้งเป็นหมด เพิ่มไม่ได้', async () => {
    const cartId = (await request(app).post('/carts')).body.id;

    const res = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'matcha-latte', optionChoiceIds: ['size-m'], quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MENU_ITEM_UNAVAILABLE');
  });
});
