import { join } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { unavailableVoiceGateway } from '../../src/modules/voice';
import { fixedClock } from '../../src/shared/clock';
import { randomIds } from '../../src/shared/ids';
import { expectMatchesSpec } from '../support/openapi';
import { startTestDatabase, type TestDatabase } from '../support/postgres';

describe('UC-04 หน้าตู้จาก origin เดียวกัน (e2e)', () => {
  let db: TestDatabase;
  let app: Express;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({
      pool: db.pool,
      menuPath: join(import.meta.dirname, '../../data/menu.json'),
      clock: fixedClock('2026-10-19T02:30:00Z'),
      ids: randomIds,
      voice: { gateway: unavailableVoiceGateway, consentPath: join(import.meta.dirname, '../../data/voice-consent.json'), kioskId: 'kiosk-1' },
      kioskDir: join(import.meta.dirname, '../fixtures/kiosk-out'),
    });
  });
  afterAll(() => db?.stop());

  it('AC7: api เสิร์ฟหน้าตู้ หน้าสถานะ และ API เดิมจาก origin เดียวกัน', async () => {
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.headers['content-type']).toMatch(/text\/html/);
    expect(home.text).toContain('หน้าตู้ fixture');

    const status = await request(app).get('/q/?order=x');
    expect(status.status).toBe(200);
    expect(status.text).toContain('หน้าสถานะ fixture');

    const menu = await request(app).get('/menu');
    expect(menu.status).toBe(200);
    expectMatchesSpec('get', '/menu', menu);

    const cart = await request(app).post('/carts');
    expect(cart.status).toBe(201);
    expectMatchesSpec('post', '/carts', cart);
  });
});
