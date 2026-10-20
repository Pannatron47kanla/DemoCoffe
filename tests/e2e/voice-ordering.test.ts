import { join } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { FakeVoiceGateway } from '../../src/modules/voice/application/__tests__/fakes';
import { fixedClock } from '../../src/shared/clock';
import { randomIds } from '../../src/shared/ids';
import { expectMatchesSpec } from '../support/openapi';
import { startTestDatabase, type TestDatabase } from '../support/postgres';

// UC-03 ครบ flow ข้าม ordering กับ voice ผ่าน HTTP กับ Postgres จริงและ data/menu.json จริง
describe('UC-03 สั่งด้วยเสียง (e2e)', () => {
  let db: TestDatabase;
  let app: Express;
  let gateway: FakeVoiceGateway;
  const clock = fixedClock('2026-10-20T02:30:00Z');

  beforeAll(async () => {
    db = await startTestDatabase();
  });
  afterAll(() => db?.stop());
  beforeEach(async () => {
    await db.reset();
    clock.set('2026-10-20T02:30:00Z');
    gateway = new FakeVoiceGateway();
    app = await createApp({
      pool: db.pool,
      menuPath: join(import.meta.dirname, '../../data/menu.json'),
      clock,
      ids: randomIds,
      voice: {
        gateway,
        consentPath: join(import.meta.dirname, '../../data/voice-consent.json'),
        kioskId: 'kiosk-1',
      },
    });
  });

  it('AC3, AC4, AC7: เริ่มตะกร้า → ยินยอม → add_to_cart → change_quantity → view_cart → request_checkout → แตะยืนยัน → เรียกฟังก์ชันอีก 409', async () => {
    const started = await request(app).post('/carts');
    expect(started.status).toBe(201);
    expectMatchesSpec('post', '/carts', started);
    const cartId = started.body.id;

    const session = await request(app).post('/voice/sessions').send({ cartId, consentTextVersion: 'voice-demo-v1' });
    expect(session.status).toBe(201);
    expectMatchesSpec('post', '/voice/sessions', session);
    const sessionId = session.body.id;
    expect(gateway.setups[0]?.systemInstruction).toContain('ลาเต้');

    const call = (name: string, args: Record<string, unknown>) =>
      request(app).post(`/voice/sessions/${sessionId}/function-calls`).send({ name, args });
    const path = '/voice/sessions/{sessionId}/function-calls';

    const added = await call('add_to_cart', { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 });
    expect(added.status).toBe(200);
    expect(added.body.action).toBe('SHOW_CART');
    expect(added.body.cart.total.amount).toBe('160.00');
    expectMatchesSpec('post', path, added);
    const lineId = added.body.cart.lines[0].id;

    const changed = await call('change_quantity', { lineId, quantity: 3 });
    expect(changed.status).toBe(200);
    expectMatchesSpec('post', path, changed);

    const viewed = await call('view_cart', {});
    expect(viewed.status).toBe(200);
    expect(viewed.body.cart.lines[0].quantity).toBe(3);
    expectMatchesSpec('post', path, viewed);

    const requested = await call('request_checkout', {});
    expect(requested.status).toBe(200);
    expect(requested.body.action).toBe('SHOW_CHECKOUT');
    expect(requested.body.cart.status).toBe('OPEN');
    expectMatchesSpec('post', path, requested);

    const placed = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-voice-ordering-e2e');
    expect(placed.status).toBe(201);
    expectMatchesSpec('post', '/carts/{cartId}/checkout', placed);

    const late = await call('view_cart', {});
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('CART_ALREADY_CHECKED_OUT');
    expectMatchesSpec('post', path, late);

    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM orders');
    expect(rows[0].n).toBe(1);
  });
});
