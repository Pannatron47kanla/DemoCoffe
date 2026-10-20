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

// UC-04 AC4, AC28: ข้าม use case ตั้งแต่แตะสั่ง ยืนยัน ไปจนเปิดหน้าสถานะจาก statusPageUrl
describe('UC-04 จากยืนยันออเดอร์ถึงหน้าสถานะ (e2e)', () => {
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
      publicBaseUrl: 'https://demo.example.com',
      voice: { gateway: unavailableVoiceGateway, consentPath: join(import.meta.dirname, '../../data/voice-consent.json'), kioskId: 'kiosk-1' },
    });
  });
  afterAll(() => db?.stop());
  beforeEach(async () => {
    await db.reset();
    clock.set('2026-10-19T02:30:00Z');
  });

  it('AC4, AC28: แตะสั่ง ยืนยัน แล้วเปิดหน้าสถานะจาก statusPageUrl', async () => {
    const started = await request(app).post('/carts');
    expect(started.status).toBe(201);
    expectMatchesSpec('post', '/carts', started);
    const cartId = started.body.id;

    const added = await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 });
    expect(added.status).toBe(200);
    expectMatchesSpec('post', '/carts/{cartId}/lines', added);
    expect(added.body.total.amount).toBe('160.00');

    const placed = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-e2e-status-1');
    expect(placed.status).toBe(201);
    expectMatchesSpec('post', '/carts/{cartId}/checkout', placed);
    expect(placed.body).toMatchObject({ status: 'PLACED', queueNumber: 1, total: { amount: '160.00' } });
    expect(placed.body.statusPageUrl).toBe(`https://demo.example.com/q/?order=${placed.body.id}`);

    const statusUrl = new URL(placed.body.statusPageUrl);
    const orderId = statusUrl.searchParams.get('order');
    expect(orderId).toBe(placed.body.id);

    const status = await request(app).get(`/orders/${orderId}`);
    expect(status.status).toBe(200);
    expectMatchesSpec('get', '/orders/{orderId}', status);
    expect(status.body).toMatchObject({ id: orderId, queueNumber: placed.body.queueNumber, total: { amount: '160.00' } });
    expect(status.body).not.toHaveProperty('cartId');
    expect(status.body).not.toHaveProperty('statusPageUrl');
  });
});
