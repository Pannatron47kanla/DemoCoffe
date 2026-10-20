import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectMatchesSpec } from '../../../../../../tests/support/openapi';
import { errorHandler } from '../../../../../shared/http-errors';
import { fixedClock } from '../../../../../shared/clock';
import { sequentialIds } from '../../../../../shared/ids';
import { VoiceConsentText } from '../../../domain/voice-consent-text';
import { FakeCartAvailability, FakeConsentTexts, FakeVoiceCartOperations, FakeVoiceGateway, FakeVoiceMenu, InMemoryVoiceSessions } from '../../../application/__tests__/fakes';
import { createVoiceModule } from '../../../module';
import { unavailableVoiceGateway } from '../../../index';
import { createOrderingModule } from '../../../../ordering';
import { FakeMenu, InMemoryOrdering } from '../../../../ordering/application/__tests__/fakes';
import { americano, latte, matchaSoldOut } from '../../../../ordering/domain/__tests__/menu-fixtures';

describe('voice HTTP routes', () => {
  let consentTexts: FakeConsentTexts;
  let sessions: InMemoryVoiceSessions;
  let gateway: FakeVoiceGateway;
  let carts: FakeCartAvailability;
  let app: express.Express;

  beforeEach(() => {
    consentTexts = new FakeConsentTexts();
    sessions = new InMemoryVoiceSessions();
    gateway = new FakeVoiceGateway();
    carts = new FakeCartAvailability();
    app = express();
    app.use(express.json());
    app.use(createVoiceModule({
      sessions, carts, consentTexts, gateway, menu: new FakeVoiceMenu(), cartOperations: new FakeVoiceCartOperations(),
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

  const CART = '7d0f1a52-4b8e-4c1e-9a77-2f1d3c4b5a60';

  it.each([
    [{}, ['cartId', 'consentTextVersion']],
    [{ cartId: CART }, ['consentTextVersion']],
    [{ consentTextVersion: 'voice-demo-v1' }, ['cartId']],
    [{ cartId: CART, consentTextVersion: '' }, ['consentTextVersion']],
    [{ cartId: 42, consentTextVersion: 'voice-demo-v1' }, ['cartId']],
  ])('AC5: body %j ตอบ 400 VALIDATION_ERROR fields %j', async (body, fields) => {
    const res = await request(app).post('/voice/sessions').send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fields).toEqual(fields);
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC5: ไม่ส่ง body เลย ตอบ 400 VALIDATION_ERROR ทั้งสองฟิลด์', async () => {
    const res = await request(app).post('/voice/sessions');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.fields).toEqual(['cartId', 'consentTextVersion']);
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
  });

  it('AC6: cartId ที่ไม่มีตอบ 404 CART_NOT_FOUND ไม่มีบันทึก', async () => {
    carts.rejectWith = 'CART_NOT_FOUND';

    const res = await request(app).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CART_NOT_FOUND');
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC6: cartId ไม่ใช่ uuid ตอบ 404 CART_NOT_FOUND', async () => {
    const res = await request(app).post('/voice/sessions').send({ cartId: 'abc', consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CART_NOT_FOUND');
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC8: ตอบ 409 CART_ALREADY_CHECKED_OUT ไม่มีบันทึก', async () => {
    carts.rejectWith = 'CART_ALREADY_CHECKED_OUT';

    const res = await request(app).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_ALREADY_CHECKED_OUT');
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC9: ยินยอมข้อความเก่า ตอบ 409 CONSENT_TEXT_OUTDATED พร้อม currentVersion ไม่มีบันทึก', async () => {
    consentTexts.text = VoiceConsentText.of('voice-demo-v2', 'ข้อความใหม่');

    const res = await request(app).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONSENT_TEXT_OUTDATED');
    expect(res.body.details.currentVersion).toBe('voice-demo-v2');
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC10: ปิดเสียง GET /voice/consent-text ตอบ 503 VOICE_UNAVAILABLE', async () => {
    gateway.available = false;

    const res = await request(app).get('/voice/consent-text');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VOICE_UNAVAILABLE');
    expectMatchesSpec('get', '/voice/consent-text', res);
  });

  it('AC10: ปิดเสียง POST /voice/sessions ตอบ 503 ไม่มีบันทึก', async () => {
    gateway.available = false;

    const res = await request(app).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VOICE_UNAVAILABLE');
    expectMatchesSpec('post', '/voice/sessions', res);
    expect(sessions.count()).toBe(0);
    expect(gateway.calls.length).toBe(0);
  });

  it('AC11: ขอโทเคนไม่สำเร็จ POST /voice/sessions ตอบ 503 VOICE_UNAVAILABLE', async () => {
    gateway.fail = true;

    const res = await request(app).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VOICE_UNAVAILABLE');
    expectMatchesSpec('post', '/voice/sessions', res);
  });

  // ไม่ใช้ createApp เพราะต้องมี DB; ต่อ router ordering (in-memory) กับ voice ที่ใช้ unavailableVoiceGateway
  it('AC15: ใช้ unavailableVoiceGateway ขอข้อความยินยอมหรือยินยอมได้ 503 แต่ POST /carts ยังได้ 201', async () => {
    const clock = fixedClock('2026-10-20T02:30:00Z');
    const ids = sequentialIds();
    const ordering = createOrderingModule({ uow: new InMemoryOrdering(), menu: new FakeMenu([americano]), clock, ids });
    const voice = createVoiceModule({
      sessions, carts: ordering.cartAvailability, consentTexts, gateway: unavailableVoiceGateway, menu: new FakeVoiceMenu(), cartOperations: new FakeVoiceCartOperations(), clock, ids, kioskId: 'kiosk-1',
    });
    const offApp = express();
    offApp.use(express.json());
    offApp.use(ordering.router);
    offApp.use(voice.router);
    offApp.use(errorHandler);

    const consentText = await request(offApp).get('/voice/consent-text');
    const consent = await request(offApp).post('/voice/sessions').send({ cartId: CART, consentTextVersion: 'voice-demo-v1' });
    const cart = await request(offApp).post('/carts');

    expect(consentText.status).toBe(503);
    expect(consent.status).toBe(503);
    expect(consent.body.code).toBe('VOICE_UNAVAILABLE');
    expect(cart.status).toBe(201);
    expect(sessions.count()).toBe(0);
  });

  it('AC3: POST /voice/sessions/{id}/function-calls add_to_cart ตอบ 200 ตาม spec', async () => {
    const clock = fixedClock('2026-10-20T02:30:00Z');
    const ids = sequentialIds();
    const ordering = createOrderingModule({ uow: new InMemoryOrdering(), menu: new FakeMenu([latte, americano]), clock, ids });
    const voice = createVoiceModule({
      sessions, carts: ordering.cartAvailability, consentTexts, gateway, menu: new FakeVoiceMenu(),
      cartOperations: ordering.voiceCart, clock, ids, kioskId: 'kiosk-1',
    });
    const both = express();
    both.use(express.json());
    both.use(ordering.router);
    both.use(voice.router);
    both.use(errorHandler);
    const cart = await request(both).post('/carts');
    const consent = await request(both).post('/voice/sessions').send({ cartId: cart.body.id, consentTextVersion: 'voice-demo-v1' });

    const res = await request(both)
      .post(`/voice/sessions/${consent.body.id}/function-calls`)
      .send({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 } });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('SHOW_CART');
    expect(res.body.cart.id).toBe(cart.body.id);
    expect(res.body.cart.lines[0].quantity).toBe(2);
    expect(res.body.cart.total.amount).toBe('160.00');
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  // ประกอบ ordering จริง (in-memory) กับ voice ใน app เดียว แล้วยินยอมเสียง
  async function composeWithConsent(clock = fixedClock('2026-10-20T02:30:00Z')) {
    const ids = sequentialIds();
    const uow = new InMemoryOrdering();
    const ordering = createOrderingModule({ uow, menu: new FakeMenu([latte, americano, matchaSoldOut]), clock, ids });
    const voice = createVoiceModule({
      sessions, carts: ordering.cartAvailability, consentTexts, gateway, menu: new FakeVoiceMenu(),
      cartOperations: ordering.voiceCart, clock, ids, kioskId: 'kiosk-1',
    });
    const both = express();
    both.use(express.json());
    both.use(ordering.router);
    both.use(voice.router);
    both.use(errorHandler);
    const cart = await request(both).post('/carts');
    const consent = await request(both).post('/voice/sessions').send({ cartId: cart.body.id, consentTextVersion: 'voice-demo-v1' });
    const call = (body: unknown) => request(both).post(`/voice/sessions/${consent.body.id}/function-calls`).send(body as object);
    return { both, cart: cart.body, call, uow };
  }

  it('AC4: POST /voice/sessions/{id}/function-calls change_quantity เปลี่ยนเป็น 4 แก้ว ตอบ 200 ตาม spec', async () => {
    const { call } = await composeWithConsent();
    const added = await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 } });

    const res = await call({ name: 'change_quantity', args: { lineId: added.body.cart.lines[0].id, quantity: 4 } });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('SHOW_CART');
    expect(res.body.cart.lines[0].quantity).toBe(4);
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  it('AC5: POST /voice/sessions/{id}/function-calls remove_from_cart ลบรายการ ตะกร้าว่าง ตอบ 200 ตาม spec', async () => {
    const { call } = await composeWithConsent();
    const added = await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 } });

    const res = await call({ name: 'remove_from_cart', args: { lineId: added.body.cart.lines[0].id } });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('SHOW_CART');
    expect(res.body.cart.lines).toEqual([]);
    expect(res.body.cart.totalCups).toBe(0);
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  it('AC6: view_cart คืนตะกร้าล่าสุด ไม่เปลี่ยนอะไร', async () => {
    const clock = fixedClock('2026-10-20T02:30:00Z');
    const { both, cart, call } = await composeWithConsent(clock);
    await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 } });
    const before = await request(both).get(`/carts/${cart.id}`);
    clock.advance(5 * 60 * 1000); // เวลาผ่านไป ถ้า view ต่ออายุ expiresAt จะเปลี่ยน

    const res = await call({ name: 'view_cart', args: {} });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('SHOW_CART');
    expect(res.body.cart.expiresAt).toBe(before.body.expiresAt);
    expect(res.body.cart.lines).toEqual(before.body.lines);
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  it('AC7: request_checkout ตอบ SHOW_CHECKOUT ตะกร้ายัง OPEN ไม่มีออเดอร์', async () => {
    const clock = fixedClock('2026-10-20T02:30:00Z');
    const { both, cart, call, uow } = await composeWithConsent(clock);
    await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 } });
    const before = await request(both).get(`/carts/${cart.id}`);
    clock.advance(5 * 60 * 1000); // ถ้า request_checkout ต่ออายุ expiresAt จะเปลี่ยน

    const res = await call({ name: 'request_checkout', args: {} });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('SHOW_CHECKOUT');
    expect(res.body.cart.status).toBe('OPEN');
    expect(res.body.cart.expiresAt).toBe(before.body.expiresAt);
    expect(uow.orders.size).toBe(0);
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  it('AC8: request_checkout ตะกร้าว่าง ตอบ 409 CART_EMPTY ตาม spec ไม่มีออเดอร์', async () => {
    const { call, uow } = await composeWithConsent();

    const res = await call({ name: 'request_checkout', args: {} });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_EMPTY');
    expect(uow.orders.size).toBe(0);
    expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res);
  });

  const FN_CALLS = '/voice/sessions/{sessionId}/function-calls';

  it('AC9: add_to_cart อเมริกาโน่ไม่เลือกขนาด → 409 OPTION_REQUIRED groupId size', async () => {
    const { call, both, cart } = await composeWithConsent();

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'americano', optionChoiceIds: [], quantity: 1 } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OPTION_REQUIRED');
    expect(res.body.details.groupId).toBe('size');
    expectMatchesSpec('post', FN_CALLS, res);
    expect((await request(both).get(`/carts/${cart.id}`)).body.lines).toEqual([]);
  });

  it('AC10: add_to_cart bubble-tea → 404 MENU_ITEM_NOT_FOUND', async () => {
    const { call } = await composeWithConsent();

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'bubble-tea', optionChoiceIds: [], quantity: 1 } });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MENU_ITEM_NOT_FOUND');
    expectMatchesSpec('post', FN_CALLS, res);
  });

  it('AC11: add_to_cart มัทฉะลาเต้ที่หมด → 409 MENU_ITEM_UNAVAILABLE', async () => {
    const { call } = await composeWithConsent();

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'matcha-latte', optionChoiceIds: ['size-m'], quantity: 1 } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MENU_ITEM_UNAVAILABLE');
    expectMatchesSpec('post', FN_CALLS, res);
  });

  it('AC12: ตะกร้า 18 แก้วเพิ่มอีก 3 → 409 CART_LIMIT_REACHED', async () => {
    const { call, both, cart } = await composeWithConsent();
    await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-m'], quantity: 10 } });
    await call({ name: 'add_to_cart', args: { menuItemId: 'americano', optionChoiceIds: ['size-m'], quantity: 8 } });

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'americano', optionChoiceIds: ['size-l'], quantity: 3 } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CART_LIMIT_REACHED');
    expectMatchesSpec('post', FN_CALLS, res);
    expect((await request(both).get(`/carts/${cart.id}`)).body.totalCups).toBe(18);
  });

  it('AC12: add_to_cart 11 แก้ว → 409 QUANTITY_OUT_OF_RANGE', async () => {
    const { call } = await composeWithConsent();

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-m'], quantity: 11 } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUANTITY_OUT_OF_RANGE');
    expectMatchesSpec('post', FN_CALLS, res);
  });

  it('AC13: เซสชันของตะกร้า A ใช้ lineId ของตะกร้า B → 404 CART_LINE_NOT_FOUND ตะกร้า B ไม่เปลี่ยน', async () => {
    const { both, call } = await composeWithConsent();
    const cartB = (await request(both).post('/carts')).body.id;
    const lineB = (await request(both).post(`/carts/${cartB}/lines`).send({ menuItemId: 'latte', optionChoiceIds: ['size-l'], quantity: 2 })).body.lines[0].id;
    const before = await request(both).get(`/carts/${cartB}`);

    const change = await call({ name: 'change_quantity', args: { lineId: lineB, quantity: 5 } });
    const remove = await call({ name: 'remove_from_cart', args: { lineId: lineB } });

    for (const res of [change, remove]) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CART_LINE_NOT_FOUND');
      expectMatchesSpec('post', FN_CALLS, res);
    }
    expect((await request(both).get(`/carts/${cartB}`)).body).toEqual(before.body);
  });

  it('AC13: args มี cartId ปลอม ยังใช้ตะกร้าของเซสชัน', async () => {
    const { both, cart, call } = await composeWithConsent();
    const cartB = (await request(both).post('/carts')).body.id;

    const res = await call({ name: 'view_cart', cartId: cartB, args: { cartId: cartB } });

    expect(res.status).toBe(200);
    expect(res.body.cart.id).toBe(cart.id);
    expectMatchesSpec('post', FN_CALLS, res);
  });

  it('AC18: ตะกร้าแก้ไขล่าสุด 10 นาทีก่อน add_to_cart แล้ว expiresAt = ตอนนี้ + 15 นาที', async () => {
    const clock = fixedClock('2026-10-20T02:30:00Z');
    const { call } = await composeWithConsent(clock);
    clock.advance(10 * 60 * 1000);

    const res = await call({ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: ['size-l'], quantity: 1 } });

    expect(res.status).toBe(200);
    expect(res.body.cart.expiresAt).toBe('2026-10-20T02:55:00.000Z');
    expectMatchesSpec('post', FN_CALLS, res);
  });
});
