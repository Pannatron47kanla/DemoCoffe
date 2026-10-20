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

// UC-02 ครบ flow ข้าม ordering กับ voice ผ่าน HTTP กับ Postgres จริงและ data/voice-consent.json จริง
describe('UC-02 เริ่มเซสชันเสียง (e2e)', () => {
  let db: TestDatabase;
  let app: Express;
  const clock = fixedClock('2026-10-20T02:30:00Z');

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({
      pool: db.pool,
      menuPath: join(import.meta.dirname, '../../data/menu.json'),
      clock,
      ids: randomIds,
      voice: {
        gateway: new FakeVoiceGateway(),
        consentPath: join(import.meta.dirname, '../../data/voice-consent.json'),
        kioskId: 'kiosk-1',
      },
    });
  });
  afterAll(() => db?.stop());
  beforeEach(async () => {
    await db.reset();
    clock.set('2026-10-20T02:30:00Z');
  });

  it('AC2, AC4, AC8: เริ่มตะกร้า → ข้อความยินยอม → ยินยอม 201 → กดซ้ำ 200 → ยืนยันออเดอร์ → ยินยอมอีก 409', async () => {
    const cartId = (await request(app).post('/carts')).body.id;
    await request(app).post(`/carts/${cartId}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 1 }).expect(200);

    const text = await request(app).get('/voice/consent-text');
    expect(text.status).toBe(200);
    expectMatchesSpec('get', '/voice/consent-text', text);

    const first = await request(app).post('/voice/sessions').send({ cartId, consentTextVersion: 'voice-demo-v1' });
    expect(first.status).toBe(201);
    expectMatchesSpec('post', '/voice/sessions', first);

    const again = await request(app).post('/voice/sessions').send({ cartId, consentTextVersion: 'voice-demo-v1' });
    expect(again.status).toBe(200);
    expectMatchesSpec('post', '/voice/sessions', again);

    const placed = await request(app).post(`/carts/${cartId}/checkout`).set('Idempotency-Key', 'k-voice-e2e');
    expect(placed.status).toBe(201);

    const late = await request(app).post('/voice/sessions').send({ cartId, consentTextVersion: 'voice-demo-v1' });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('CART_ALREADY_CHECKED_OUT');
    expectMatchesSpec('post', '/voice/sessions', late);

    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM voice_sessions');
    expect(rows[0].n).toBe(1);
  });
});
