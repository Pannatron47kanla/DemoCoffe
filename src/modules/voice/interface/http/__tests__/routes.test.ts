import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../../../../../../tests/support/openapi';
import { errorHandler } from '../../../../../shared/http-errors';
import { fixedClock } from '../../../../../shared/clock';
import { sequentialIds } from '../../../../../shared/ids';
import { FakeCartAvailability, FakeConsentTexts, FakeVoiceGateway, InMemoryVoiceSessions } from '../../../application/__tests__/fakes';
import { createVoiceModule } from '../../../module';

describe('voice HTTP routes', () => {
  let consentTexts: FakeConsentTexts;
  let app: express.Express;

  beforeEach(() => {
    consentTexts = new FakeConsentTexts();
    app = express();
    app.use(express.json());
    app.use(createVoiceModule({
      sessions: new InMemoryVoiceSessions(), carts: new FakeCartAvailability(), consentTexts, gateway: new FakeVoiceGateway(),
      clock: fixedClock('2026-10-20T02:30:00Z'), ids: sequentialIds(), kioskId: 'kiosk-1',
    }).router);
    app.use(errorHandler);
  });

  it('AC1: GET /voice/consent-text ตอบ 200 version และ text ตาม spec', async () => {
    const res = await request(app).get('/voice/consent-text');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      version: 'voice-demo-v1',
      text: consentTexts.text.text,
    });
    expectMatchesSpec('get', '/voice/consent-text', res);
  });

  it('AC2: POST /voice/sessions ตอบ 201 ตาม spec', async () => {
    const res = await request(app)
      .post('/voice/sessions')
      .send({ cartId: '7d0f1a52-4b8e-4c1e-9a77-2f1d3c4b5a60', consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(201);
    expect(res.body.consentedAt).toBe('2026-10-20T02:30:00.000Z');
    expect(res.body.connection.startBefore).toBe('2026-10-20T02:31:00.000Z');
    expectMatchesSpec('post', '/voice/sessions', res);
  });

  it('AC4: POST /voice/sessions ครั้งที่สองตอบ 200 ตาม spec', async () => {
    const body = { cartId: '7d0f1a52-4b8e-4c1e-9a77-2f1d3c4b5a60', consentTextVersion: 'voice-demo-v1' };
    const first = await request(app).post('/voice/sessions').send(body);

    const res = await request(app).post('/voice/sessions').send(body);

    expect(first.status).toBe(201);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(first.body.id);
    expect(res.body.connection.token).not.toBe(first.body.connection.token);
    expectMatchesSpec('post', '/voice/sessions', res);
  });
});
