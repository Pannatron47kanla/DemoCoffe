import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../../../../../../tests/support/openapi';
import { errorHandler } from '../../../../../shared/http-errors';
import { FakeConsentTexts, FakeVoiceGateway } from '../../../application/__tests__/fakes';
import { createVoiceModule } from '../../../module';

describe('voice HTTP routes', () => {
  let consentTexts: FakeConsentTexts;
  let app: express.Express;

  beforeEach(() => {
    consentTexts = new FakeConsentTexts();
    app = express();
    app.use(express.json());
    app.use(createVoiceModule({ consentTexts, gateway: new FakeVoiceGateway() }).router);
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
});
