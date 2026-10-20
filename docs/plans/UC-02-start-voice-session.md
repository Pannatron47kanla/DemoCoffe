# UC-02 ยินยอมและเริ่มสั่งด้วยเสียง — แผนงาน

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ทุก subagent ต้องได้ `AGENTS.md` และ `.claude/skills/ddd-architecture/SKILL.md` ไปด้วย

**Goal:** ลูกค้าหน้าตู้ยินยอมเรื่องเสียงได้ ระบบบันทึกหลักฐานความยินยอมหนึ่งครั้งต่อตะกร้า และออกโทเคนชั่วคราวของ Gemini Live ให้ตู้เปิดเซสชันเสียงเอง

**Architecture:** สร้าง context `voice` ระดับ light ใน `src/modules/voice/` ตามรูปแบบของ ordering (domain → application → infrastructure → interface/http, `module.ts`, `index.ts`) voice ถาม ordering ว่าตะกร้ายังเปิดอยู่ไหมผ่าน port `CartAvailability` ซึ่ง ordering ส่งออกทาง `src/modules/ordering/index.ts` ส่วนการขอโทเคนจาก Google ผ่าน port `VoiceGateway` ซึ่งมี adapter `AiStudioVoiceGateway` (ใช้ `@google/genai`) และ `unavailableVoiceGateway` (ตอนปิดเสียง)

**Tech Stack:** TypeScript, Express 5, pg, Vitest, Testcontainers, supertest, `@google/genai` (เพิ่มใหม่)

**Spec:** `docs/usecases/UC-02-start-voice-session.md`, `openapi.yaml` (`/voice/consent-text`, `/voice/sessions`), `db/migrations/20261020_0900_create_voice_sessions.sql`, `docs/architecture/context-map.md`

## Global Constraints
- KEY คือ `UC-02` หนึ่ง AC ต่อหนึ่ง commit ข้อความ `UC-02 AC<n>: ...` ลงท้ายด้วยบรรทัด `Co-Authored-By` ตามที่ session กำหนด
- ชื่อเทสต์ขึ้นต้นด้วย `AC<n>: ` ทุกตัว
- ห้าม `new Date()` / `Date.now()` ใน domain และ application ใช้ `Clock` (`fixedClock` ในเทสต์)
- domain โยน `new DomainError('<CODE>')` code ต้องอยู่ใน `openapi.yaml` และ `src/shared/http-errors.ts`
- เวลาในเทสต์: "09:30" ใน AC2 คือ `2026-10-20T02:30:00Z` (Asia/Bangkok)
- รหัสตู้ `kiosk-1` มาจาก `KIOSK_ID` เวอร์ชันข้อความ `voice-demo-v1` รุ่น `gemini-3.8-live`
- โทเคน: ใช้ได้ 1 ครั้ง (`uses: 1`) เริ่มภายใน 60 วินาที (`newSessionExpireTime`) อายุโทเคน 15 นาที (`expireTime`, R6) ตอบเป็นเสียง เปิด session resumption
- คำขอไป Google ต้องไม่มี cartId, kioskId, ภาพ, ชื่อ หรือเบอร์โทร (R7)
- ขอโทเคนนานเกิน 3 วินาที ถือว่าไม่สำเร็จ (AC11)
- voice เขียนเฉพาะตาราง `voice_sessions` ห้ามอ่านหรือเขียนตารางของ ordering ตรงๆ
- เทสต์ repository ใช้ Postgres จริงผ่าน `tests/support/postgres.ts`
- ทุก response ตรวจด้วย `expectMatchesSpec` จาก `tests/support/openapi.ts`
- รันเทสต์ red ด้วย `rtk bypass npx vitest run <file>` แล้วใส่ข้อความ fail เต็มในรายงาน

## Review Focus
1. **ตะกร้ามีเซสชันแล้วแต่ข้อความยินยอมเปลี่ยนเวอร์ชัน** ต้องได้ 200 เซสชันเดิม ไม่ใช่ `CONSENT_TEXT_OUTDATED` (R4) → เทสต์ใน Task 4
2. **`cartId` ไม่ใช่ uuid** ต้องได้ 404 `CART_NOT_FOUND` ไม่ใช่ 500 จาก Postgres (ทำแบบเดียวกับ `cartIdOf` ของ ordering) → เทสต์ใน Task 6
3. **`data/voice-consent.json` เสียหายหรือไม่มีไฟล์** ต้องได้ 503 `VOICE_UNAVAILABLE` ไม่ใช่ 500 เพื่อให้ตู้กลับไปสั่งด้วยการแตะ (R8) → เทสต์ใน Task 1
4. **Google ตอบสำเร็จแต่ไม่มี `name`** ต้องถือว่าไม่สำเร็จ 503 ไม่ส่งโทเคนว่างให้ตู้ → เทสต์ใน Task 12
5. **ไม่เคยยินยอมแล้วชนที่ Google ครั้งแรก** การกดครั้งต่อไปต้องได้ 200 ไม่ใช่ 201 ซ้ำ และไม่มีแถวที่สอง → เทสต์ใน Task 12

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/modules/voice/domain/voice-consent-text.ts` | `VoiceConsentText` (version, text) |
| `src/modules/voice/domain/voice-session.ts` | `VoiceSession` aggregate root: `consent()`, `restore()`, `toState()` |
| `src/modules/voice/domain/voice-connection.ts` | `VoiceConnection` และค่าคงที่ของเวลา R6 |
| `src/modules/voice/domain/voice-availability.ts` | `assertVoiceAvailable(available)` (R8) |
| `src/modules/voice/domain/repositories.ts` | `VoiceSessionRepository` |
| `src/modules/voice/application/ports.ts` | `CartAvailability`, `ConsentTexts`, `VoiceGateway` |
| `src/modules/voice/application/get-voice-consent-text.ts` | use case AC1 |
| `src/modules/voice/application/start-voice-session.ts` | use case AC2–AC13 |
| `src/modules/voice/application/__tests__/fakes.ts` | fake repository, gateway, cart availability, consent texts |
| `src/modules/voice/infrastructure/json-voice-consent-texts.ts` | อ่าน `data/voice-consent.json` ใหม่ทุกครั้ง |
| `src/modules/voice/infrastructure/pg-voice-session-repository.ts` | SQL ของ `voice_sessions` |
| `src/modules/voice/infrastructure/ai-studio-voice-gateway.ts` | ขอ ephemeral token ผ่าน `@google/genai` |
| `src/modules/voice/infrastructure/unavailable-voice-gateway.ts` | gateway ตอนปิดเสียง |
| `src/modules/voice/interface/http/routes.ts`, `mapper.ts` | HTTP ตาม `openapi.yaml` |
| `src/modules/voice/voice-config.ts` | อ่าน env → `VoiceConfig` (AC14, AC15) |
| `src/modules/voice/module.ts`, `index.ts` | ต่อสาย และสิ่งที่ส่งออก |
| `src/modules/ordering/domain/cart.ts` | เพิ่ม `ensureOpen(now)` |
| `src/modules/ordering/application/check-cart-availability.ts` | use case ฝั่ง ordering สำหรับ port ของ voice |
| `src/modules/ordering/index.ts` | ใหม่: ส่งออก `createOrderingModule` |
| `src/app.ts`, `src/main.ts`, `docker-compose.yml` | ต่อสาย voice และ env |

## Interfaces กลาง (ทุก task ใช้ชื่อนี้)

```ts
// voice/domain
export class VoiceConsentText { static of(version: string, text: string): VoiceConsentText; readonly version: string; readonly text: string }
export interface VoiceSessionState { id: string; cartId: string; kioskId: string; consentTextVersion: string; consentedAt: Date }
export class VoiceSession {
  static consent(input: { id: string; cartId: string; kioskId: string; shownVersion: string; current: VoiceConsentText; now: Date }): VoiceSession;
  static restore(state: VoiceSessionState): VoiceSession;
  toState(): VoiceSessionState;
  readonly id: string; readonly cartId: string; readonly consentTextVersion: string; readonly consentedAt: Date;
}
export interface VoiceConnection { token: string; model: string; startBefore: Date }
export const VOICE_CONNECTION = { START_WITHIN_SECONDS: 60, TOKEN_LIFETIME_MINUTES: 15, ISSUE_TIMEOUT_MS: 3000 } as const;
export function assertVoiceAvailable(available: boolean): void; // โยน VOICE_UNAVAILABLE
export interface VoiceSessionRepository {
  findByCartId(cartId: string): Promise<VoiceSession | null>;
  /** ถ้าตะกร้ามีเซสชันอยู่แล้ว คืนของเดิมและ created=false (R4, AC13) */
  add(session: VoiceSession): Promise<{ session: VoiceSession; created: boolean }>;
}

// voice/application/ports.ts
export interface CartAvailability { assertOpen(cartId: string): Promise<void> } // CART_NOT_FOUND | CART_EXPIRED | CART_ALREADY_CHECKED_OUT
export interface ConsentTexts { current(): Promise<VoiceConsentText> }        // อ่านไม่ได้ → VOICE_UNAVAILABLE
export interface VoiceGateway { readonly available: boolean; issueConnection(now: Date): Promise<VoiceConnection> } // ไม่สำเร็จ → VOICE_UNAVAILABLE

// voice/application
export class StartVoiceSession {
  constructor(deps: { sessions: VoiceSessionRepository; carts: CartAvailability; consentTexts: ConsentTexts; gateway: VoiceGateway; clock: Clock; ids: IdGenerator; kioskId: string });
  execute(input: { cartId: string; consentTextVersion: string }): Promise<{ session: VoiceSession; connection: VoiceConnection; created: boolean }>;
}
export class GetVoiceConsentText { constructor(deps: { consentTexts: ConsentTexts; gateway: VoiceGateway }); execute(): Promise<VoiceConsentText> }

// voice/module.ts
export function createVoiceModule(deps: { sessions: VoiceSessionRepository; carts: CartAvailability; consentTexts: ConsentTexts; gateway: VoiceGateway; clock: Clock; ids: IdGenerator; kioskId: string }): { router: Router };

// voice/voice-config.ts
export interface VoiceConfig { enabled: boolean; model: string; apiKey: string | undefined; kioskId: string; consentPath: string; disabledReason?: string }
export function loadVoiceConfig(env: Record<string, string | undefined>): VoiceConfig; // ตั้งผิด → throw Error

// ordering
// Cart.ensureOpen(now: Date): void   — เรียก assertModifiable เดิม
// createOrderingModule(...) คืนเพิ่ม cartAvailability: { assertOpen(cartId: string): Promise<void> }

// app.ts
// createApp({ pool, menuPath, clock, ids, voice: { gateway: VoiceGateway; consentPath: string; kioskId: string } })
```

Fakes ใน `src/modules/voice/application/__tests__/fakes.ts`:
- `InMemoryVoiceSessions implements VoiceSessionRepository` เก็บ `VoiceSessionState` แบบ `structuredClone` มี `count()`
- `FakeVoiceGateway implements VoiceGateway` มี `available = true`, `fail = false`, `calls: Date[]`; ตอบ `{ token: 'auth_tokens/fake-<n>', model: 'gemini-3.8-live', startBefore: now + 60 วินาที }`
- `FakeCartAvailability implements CartAvailability` มี `rejectWith?: string` (code ที่จะโยน)
- `FakeConsentTexts implements ConsentTexts` มี `text = VoiceConsentText.of('voice-demo-v1', '...')`

---

### Task 1: AC1 ข้อความยินยอม (ตั้งโครง context voice)

**Files:**
- Create: `src/modules/voice/domain/voice-consent-text.ts`, `voice-availability.ts`, `application/ports.ts`, `application/get-voice-consent-text.ts`, `application/__tests__/fakes.ts`, `infrastructure/json-voice-consent-texts.ts`, `infrastructure/unavailable-voice-gateway.ts`, `interface/http/routes.ts`, `interface/http/mapper.ts`, `module.ts`, `index.ts`
- Modify: `src/app.ts`, `src/main.ts`, `tests/e2e/place-kiosk-order.test.ts` (ส่ง `voice` ให้ `createApp`), `src/shared/http-errors.ts` (เพิ่ม `VOICE_UNAVAILABLE: 503 'ตอนนี้สั่งด้วยเสียงไม่ได้ กรุณาสั่งด้วยการแตะ'`)
- Test: `src/modules/voice/infrastructure/__tests__/json-voice-consent-texts.test.ts`, `src/modules/voice/interface/http/__tests__/routes.test.ts`

ในขั้นนี้ `assertVoiceAvailable` ยังไม่ถูกเรียก (Task 10) และ `startVoiceSession` ยังไม่มี

- [ ] **Step 1: เทสต์ที่ fail**
  - `json-voice-consent-texts.test.ts`: `it('AC1: อ่าน data/voice-consent.json จริง ได้ voice-demo-v1 และข้อความตาม R10')` ตรวจ `version === 'voice-demo-v1'` และ `text` มี `'Google'`, `'ปรับปรุงบริการ'`, `'ตรวจอ่าน'`, `'สิงคโปร์'`
  - `it('AC1: อ่านไฟล์ใหม่ทุกครั้ง แก้ไฟล์แล้วได้เวอร์ชันใหม่โดยไม่ต้องสร้างใหม่')` เขียนไฟล์ชั่วคราวใน `os.tmpdir()` เป็น v1 → อ่าน → เขียนทับเป็น `voice-demo-v2` → อ่านได้ v2
  - `it('AC1: ไฟล์ไม่มีหรือ JSON เสีย → VOICE_UNAVAILABLE')` (Review Focus 3) คาด `DomainError` code `VOICE_UNAVAILABLE`
  - `routes.test.ts`: `it('AC1: GET /voice/consent-text ตอบ 200 version และ text ตาม spec')` ใช้ `FakeConsentTexts` + `FakeVoiceGateway` คาด `{ version: 'voice-demo-v1', text }` และ `expectMatchesSpec('get', '/voice/consent-text', res)`
- [ ] **Step 2: รัน** `rtk bypass npx vitest run src/modules/voice` คาด FAIL เพราะ import ไม่พบโมดูล
- [ ] **Step 3: เขียนโค้ด** ตาม Interfaces กลาง `JsonVoiceConsentTexts` รับ `path: string` และอ่านด้วย `readFile` ทุกครั้งที่เรียก `current()` แล้วแปลง error ทุกแบบเป็น `DomainError('VOICE_UNAVAILABLE')` ส่วน `unavailableVoiceGateway` มี `available: false` และ `issueConnection` โยน `VOICE_UNAVAILABLE` ส่วน `index.ts` ส่งออก `createVoiceModule`, `loadVoiceConfig` (Task 14), type `VoiceGateway` และ adapter ทั้งสองตัว ใน task นี้ `createVoiceModule` รับแค่ `{ consentTexts, gateway }` ส่วน deps ที่เหลือเพิ่มใน Task 2 ส่วน `app.ts` สร้าง `JsonVoiceConsentTexts(voice.consentPath)` แล้วส่งเข้า voice module ส่วน `main.ts` ใช้ `unavailableVoiceGateway` ชั่วคราวจนถึง Task 14
- [ ] **Step 4: รัน** `npm test` คาดผ่านทั้งหมด และ `npm run lint` ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC1: get voice consent text from data/voice-consent.json`

### Task 2: AC2 ยินยอมครั้งแรก สร้างเซสชันและคืนข้อมูลเชื่อมต่อ

**Files:**
- Create: `src/modules/voice/domain/voice-session.ts`, `voice-connection.ts`, `repositories.ts`, `application/start-voice-session.ts`, `infrastructure/pg-voice-session-repository.ts`, `src/modules/ordering/application/check-cart-availability.ts`, `src/modules/ordering/index.ts`
- Modify: `src/modules/ordering/module.ts` (คืน `cartAvailability`), `src/modules/voice/module.ts`, `routes.ts`, `mapper.ts`, `src/app.ts`
- Test: `src/modules/voice/domain/__tests__/voice-session.test.ts`, `application/__tests__/start-voice-session.test.ts`, `infrastructure/__tests__/pg-voice-session-repository.test.ts`, `interface/http/__tests__/routes.test.ts`

**Interfaces:** Produces `VoiceSession`, `VoiceSessionRepository`, `StartVoiceSession`, `PgVoiceSessionRepository(pool: Pool)`, `CheckCartAvailability` ตามข้อความด้านบน ในขั้นนี้ `CheckCartAvailability.assertOpen` แค่โหลดตะกร้า ยังไม่โยน error (AC6–AC8 เพิ่มทีหลัง) และ `VoiceSession.consent` ยังไม่ตรวจเวอร์ชัน (AC9)

- [ ] **Step 1: เทสต์ที่ fail**
  - domain: `it('AC2: consent บันทึกเวลา ตู้ เวอร์ชัน และตะกร้า')` → `toState()` เท่ากับ `{ id, cartId, kioskId: 'kiosk-1', consentTextVersion: 'voice-demo-v1', consentedAt: 2026-10-20T02:30:00Z }`
  - application: `it('AC2: ตะกร้าเปิดอยู่ ยินยอมตอน 09:30 ได้เซสชันใหม่และข้อมูลเชื่อมต่อ')` → `created === true`, `sessions.count() === 1`, `connection.token` เริ่มด้วย `auth_tokens/`, `connection.model === 'gemini-3.8-live'`, `connection.startBefore` = `2026-10-20T02:31:00Z`, `gateway.calls` มี 1 ครั้งที่เวลา 02:30Z
  - repository (DB จริง): `it('AC2: add แล้ว findByCartId ได้ข้อมูลเดิมครบ')` สร้างแถว `carts` ก่อนด้วย SQL ในเทสต์ (FK) คาด `created === true` และ state ตรงกัน
  - route: `it('AC2: POST /voice/sessions ตอบ 201 ตาม spec')` คาด `status 201`, `body.consentedAt === '2026-10-20T02:30:00.000Z'`, `body.connection.startBefore === '2026-10-20T02:31:00.000Z'`, `expectMatchesSpec('post', '/voice/sessions', res)`
- [ ] **Step 2: รัน** คาด FAIL: module not found / 404 จาก express
- [ ] **Step 3: เขียนโค้ด** `StartVoiceSession.execute`: `carts.assertOpen` → `sessions.findByCartId` → ถ้าไม่มี `consentTexts.current()` + `VoiceSession.consent` + `sessions.add` → `gateway.issueConnection(now)` โดย `now = clock.now()` ครั้งเดียว `PgVoiceSessionRepository.add` ในขั้นนี้ใช้ `INSERT` ธรรมดา mapper แปลงเวลาเป็น ISO string route คืน 201 เมื่อ `created` และ 200 เมื่อไม่ใช่ `Cart.ensureOpen(now)` เป็น public method ที่เรียก `assertModifiable(now)` ส่วน `app.ts` ส่ง `ordering.cartAvailability` ให้ voice
- [ ] **Step 4: รัน** `npm test` ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC2: record voice consent and issue a Gemini Live connection`

### Task 3: AC3 บันทึกมีเฉพาะ เวลา ตู้ เวอร์ชัน ตะกร้า

**Files:** Test: `src/modules/voice/infrastructure/__tests__/pg-voice-session-repository.test.ts`

- [ ] **Step 1: เทสต์** `it('AC3: voice_sessions มีเฉพาะคอลัมน์หลักฐาน ไม่มีข้อมูลบุคคลหรือเสียง')` query `information_schema.columns` ของ `voice_sessions` เรียงตาม `ordinal_position` คาดเท่ากับ `['id', 'cart_id', 'kiosk_id', 'consent_text_version', 'consented_at', 'created_at', 'updated_at']`
- [ ] **Step 2: รัน** คาดว่า **ผ่านทันที** เพราะ migration ขั้นที่ 2 บังคับไว้แล้ว เทสต์นี้กันคนเพิ่มคอลัมน์ทีหลัง ยืนยันว่าเทสต์จับได้จริง: แก้ชั่วคราวให้คาดคอลัมน์ `phone` เพิ่ม รันให้เห็น fail แล้วใส่ข้อความ fail นั้นในรายงานเป็น red จากนั้นคืนค่าเดิม
- [ ] **Step 3: Commit** `UC-02 AC3: guard voice_sessions columns to consent evidence only`

### Task 4: AC4 กดเสียงซ้ำในตะกร้าเดิม

**Files:** Test: `start-voice-session.test.ts`, `routes.test.ts`; Modify: ตามที่เทสต์ต้องการ

- [ ] **Step 1: เทสต์ที่ fail**
  - application: `it('AC4: ตะกร้ามีเซสชันแล้ว ได้เซสชันเดิม ข้อมูลเชื่อมต่อใหม่ ไม่มีบันทึกเพิ่ม')` ยินยอมครั้งแรก แล้ว `clock.advance(5 * 60_000)` เรียกอีกครั้ง คาด `created === false`, `session.id` เดิม, `consentedAt` เดิม (02:30Z), token ต่างจากครั้งแรก, `sessions.count() === 1`
  - application (Review Focus 1): `it('AC4: ข้อความเปลี่ยนเป็น voice-demo-v2 หลังยินยอมแล้ว กดซ้ำยังได้เซสชันเดิม')` เปลี่ยน `consentTexts.text` เป็น v2 แล้วเรียกด้วย `voice-demo-v1` คาด `created === false`
  - route: `it('AC4: POST /voice/sessions ครั้งที่สองตอบ 200 ตาม spec')`
- [ ] **Step 2: รัน** ดูว่าส่วนไหน fail จริง (ถ้า Task 2 ทำ 200 ไว้แล้ว route อาจผ่าน ให้รายงานตามจริง) ส่วนที่ fail ต้อง fail เพราะสร้างเซสชันซ้ำหรือ token ไม่เปลี่ยน
- [ ] **Step 3: เขียนโค้ด** ให้ use case ข้าม `consent`/`add` เมื่อ `findByCartId` พบ และขอ connection ใหม่ทุกครั้ง
- [ ] **Step 4: รัน** `npm test` ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC4: reuse the cart's voice session and issue a fresh connection`

### Task 5: AC5 ข้อมูลไม่ครบ

**Files:** Modify: `src/modules/voice/interface/http/routes.ts`; Test: `routes.test.ts`

- [ ] **Step 1: เทสต์** `it.each([[{}, ['cartId', 'consentTextVersion']], [{ cartId: CART }, ['consentTextVersion']], [{ consentTextVersion: 'voice-demo-v1' }, ['cartId']], [{ cartId: CART, consentTextVersion: '' }, ['consentTextVersion']], [{ cartId: 42, consentTextVersion: 'voice-demo-v1' }, ['cartId']]])('AC5: body %j ตอบ 400 VALIDATION_ERROR fields %j', ...)` คาด `details.fields` ตรง, `expectMatchesSpec`, และ `sessions.count() === 0`
- [ ] **Step 2: รัน** คาด FAIL: ได้ 201 หรือ 500 แทน 400
- [ ] **Step 3: เขียนโค้ด** `startSessionBody(body: unknown): { cartId: string; consentTextVersion: string }` ใน routes.ts โยน `RequestValidationError` (ตรวจเฉพาะ type และค่าว่าง รูปแบบ uuid ตรวจใน Task 6)
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC5: reject voice session request without cartId or consentTextVersion`

### Task 6: AC6 ไม่พบตะกร้า

**Files:** Modify: `check-cart-availability.ts`, voice `routes.ts`; Test: `src/modules/ordering/application/__tests__/check-cart-availability.test.ts` (ใหม่), voice `routes.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - ordering: `it('AC6: ไม่มีตะกร้านี้ → CART_NOT_FOUND')` ใช้ `InMemoryOrdering`
  - voice route: `it('AC6: cartId ที่ไม่มีตอบ 404 CART_NOT_FOUND ไม่มีบันทึก')` ใช้ `FakeCartAvailability({ rejectWith: 'CART_NOT_FOUND' })`
  - voice route (Review Focus 2): `it('AC6: cartId ไม่ใช่ uuid ตอบ 404 CART_NOT_FOUND')` ด้วย `cartId: 'abc'`
- [ ] **Step 2: รัน** คาด FAIL: ordering ไม่โยน, `'abc'` ไม่ได้ 404
- [ ] **Step 3: เขียนโค้ด** ใช้ `requireCart` เดิมใน `CheckCartAvailability` และตรวจ uuid ใน voice routes แบบเดียวกับ `cartIdOf` ของ ordering
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC6: reject voice consent for a missing cart`

### Task 7: AC7 ตะกร้าหมดอายุ

**Files:** Modify: `src/modules/ordering/domain/cart.ts`, `check-cart-availability.ts`; Test: `src/modules/ordering/domain/__tests__/cart.test.ts`, `check-cart-availability.test.ts`, voice `start-voice-session.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - ordering domain: `it('AC7 (UC-02): ensureOpen หลังไม่ได้แก้ไขครบ 15 นาที → CART_EXPIRED')` ตะกร้าเริ่ม 02:30Z เรียกที่ 02:45Z
  - ordering application: `it('AC7: ตะกร้าไม่ได้แก้ไขครบ 15 นาที → CART_EXPIRED')` ใช้ `fixedClock` แล้ว `advance(15 * 60_000)`
  - voice application: `it('AC7: CartAvailability ปฏิเสธ CART_EXPIRED → ไม่มีบันทึก ไม่ขอโทเคน')` คาด `sessions.count() === 0`, `gateway.calls.length === 0`
- [ ] **Step 2: รัน** คาด FAIL: ไม่โยน error
- [ ] **Step 3: เขียนโค้ด** `CheckCartAvailability` เรียก `cart.ensureOpen(clock.now())`
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC7: reject voice consent for an expired cart`

### Task 8: AC8 ตะกร้ายืนยันแล้ว

**Files:** Test: ordering `check-cart-availability.test.ts`, voice `routes.test.ts`

- [ ] **Step 1: เทสต์** `it('AC8: ตะกร้ายืนยันออเดอร์แล้ว → CART_ALREADY_CHECKED_OUT')` (ordering, ใช้ `CheckoutCart` ของจริงกับ fakes) และ `it('AC8: ตอบ 409 CART_ALREADY_CHECKED_OUT ไม่มีบันทึก')` (voice route, `expectMatchesSpec`)
- [ ] **Step 2: รัน** คาดว่าฝั่ง ordering ผ่านทันทีเพราะ `ensureOpen` ตรวจสถานะแล้วจาก Task 7 ให้ทำแบบ Task 3: ทำให้ fail ชั่วคราว (ลบบรรทัดตรวจ `CHECKED_OUT` ใน `assertModifiable`) เก็บข้อความ fail แล้วคืนค่าเดิม
- [ ] **Step 3: Commit** `UC-02 AC8: reject voice consent for a checked-out cart`

### Task 9: AC9 เวอร์ชันข้อความไม่ใช่ปัจจุบัน

**Files:** Modify: `voice-session.ts`, `src/shared/http-errors.ts` (เพิ่ม `CONSENT_TEXT_OUTDATED: 409 'ข้อความยินยอมมีการเปลี่ยนแปลง กรุณาอ่านอีกครั้ง'`); Test: `voice-session.test.ts`, `start-voice-session.test.ts`, `routes.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - domain: `it('AC9: ยินยอมด้วย voice-demo-v1 แต่ปัจจุบันเป็น voice-demo-v2 → CONSENT_TEXT_OUTDATED พร้อม currentVersion')` คาด `details` เท่ากับ `{ currentVersion: 'voice-demo-v2' }`
  - application: ไม่มีบันทึก ไม่ขอโทเคน
  - route: 409 `details.currentVersion === 'voice-demo-v2'`, `expectMatchesSpec`
- [ ] **Step 2: รัน** คาด FAIL: สร้างเซสชันได้
- [ ] **Step 3: เขียนโค้ด** ตรวจใน `VoiceSession.consent`
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC9: reject consent given to an outdated consent text`

### Task 10: AC10 ปิดใช้เสียง

**Files:** Modify: `get-voice-consent-text.ts`, `start-voice-session.ts`; Test: `src/modules/voice/domain/__tests__/voice-availability.test.ts`, `start-voice-session.test.ts`, `routes.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - domain: `it('AC10: assertVoiceAvailable(false) → VOICE_UNAVAILABLE')`
  - route: `it('AC10: ปิดเสียง GET /voice/consent-text ตอบ 503 VOICE_UNAVAILABLE')` และ `it('AC10: ปิดเสียง POST /voice/sessions ตอบ 503 ไม่มีบันทึก')` ใช้ `FakeVoiceGateway` ที่ `available = false` คาด `sessions.count() === 0` และ `expectMatchesSpec`
- [ ] **Step 2: รัน** คาด FAIL: ได้ 200/201
- [ ] **Step 3: เขียนโค้ด** ทั้งสอง use case เรียก `assertVoiceAvailable(gateway.available)` เป็นบรรทัดแรก
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC10: answer VOICE_UNAVAILABLE when voice is turned off`

### Task 11: AC12 คำขอโทเคนไป Gemini API

**Files:** Create: `src/modules/voice/infrastructure/ai-studio-voice-gateway.ts`; Modify: `package.json` (`npm install @google/genai`); Test: `src/modules/voice/infrastructure/__tests__/ai-studio-voice-gateway.test.ts`

**Interfaces:** Produces
```ts
export interface AuthTokens { create(params: { config: Record<string, unknown> }): Promise<{ name?: string }> } // รูปเดียวกับ GoogleGenAI#authTokens
export class AiStudioVoiceGateway implements VoiceGateway {
  constructor(deps: { tokens: AuthTokens; model: string });
  readonly available: true;
}
```
ก่อนเขียน ให้ตรวจชื่อ field กับเอกสาร ephemeral token ของ Gemini API และ type ใน `@google/genai` ที่ติดตั้ง ถ้าชื่อไม่ตรงกับข้างล่าง ให้ใช้ตามเอกสารแล้วบันทึกไว้ในรายงาน

- [ ] **Step 1: เทสต์ที่ fail** ใช้ `AuthTokens` ปลอมที่จด `params` ไว้ เรียก `issueConnection(new Date('2026-10-20T02:30:00Z'))`
  - `it('AC12: ล็อกรุ่น gemini-3.8-live ตอบเป็นเสียง เปิด session resumption')` คาด `config.liveConnectConstraints.model === 'gemini-3.8-live'`, `config.liveConnectConstraints.config.responseModalities` เท่ากับ `[Modality.AUDIO]`, `config.liveConnectConstraints.config.sessionResumption` เท่ากับ `{}`, `config.httpOptions.apiVersion === 'v1alpha'`
  - `it('AC12: ใช้ได้ 1 ครั้ง เริ่มภายใน 1 นาที อายุ 15 นาที')` คาด `config.uses === 1`, `config.newSessionExpireTime === '2026-10-20T02:31:00.000Z'`, `config.expireTime === '2026-10-20T02:45:00.000Z'`
  - `it('AC12: ไม่มีข้อมูลบุคคลในคำขอ')` คาด `JSON.stringify(params)` ไม่มี `cart`, `kiosk`, `phone`, `name":`, `image`
  - `it('AC12: คืน token, model และ startBefore')` เมื่อปลอมตอบ `{ name: 'auth_tokens/abc' }`
- [ ] **Step 2: รัน** คาด FAIL: module not found
- [ ] **Step 3: เขียนโค้ด** ตาม Interfaces เวลาคำนวณจากพารามิเตอร์ `now` และ `VOICE_CONNECTION`
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC12: request a single-use audio-only Gemini Live token`

### Task 12: AC11 ขอโทเคนจาก Google ไม่สำเร็จ

**Files:** Modify: `ai-studio-voice-gateway.ts`; Test: `ai-studio-voice-gateway.test.ts`, `start-voice-session.test.ts`, `routes.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - gateway: `it('AC11: Google ตอบ 429 → VOICE_UNAVAILABLE')` ปลอมโยน `Object.assign(new Error('Too Many Requests'), { status: 429 })`
  - gateway: `it('AC11: เกิน 3 วินาที → VOICE_UNAVAILABLE')` ใช้ `vi.useFakeTimers()` ปลอมคืน promise ที่ไม่ resolve แล้ว `vi.advanceTimersByTime(3000)`
  - gateway (Review Focus 4): `it('AC11: Google ตอบไม่มี name → VOICE_UNAVAILABLE')`
  - application (Review Focus 5): `it('AC11: ขอโทเคนไม่สำเร็จ บันทึกความยินยอมยังอยู่ กดอีกครั้งไม่ถามยินยอมซ้ำ')` ครั้งแรก `gateway.fail = true` คาด reject `VOICE_UNAVAILABLE` และ `sessions.count() === 1` ครั้งที่สอง `gateway.fail = false` คาด `created === false`, `sessions.count() === 1`
  - route: 503 ตาม spec
- [ ] **Step 2: รัน** คาด FAIL: error ดิบหลุดเป็น 500 / ไม่หมดเวลา
- [ ] **Step 3: เขียนโค้ด** ห่อ `tokens.create` ด้วย timeout `VOICE_CONNECTION.ISSUE_TIMEOUT_MS` (`setTimeout`) แปลงทุก error เป็น `DomainError('VOICE_UNAVAILABLE')` และ `console.warn` สาเหตุ (ห้าม log API key)
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC11: fall back to touch ordering when Google cannot issue a token`

### Task 13: AC13 ยินยอมสองครั้งพร้อมกัน

**Files:** Modify: `pg-voice-session-repository.ts`; Test: `pg-voice-session-repository.test.ts`, `start-voice-session.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - repository (DB จริง): `it('AC13: add สองเซสชันของตะกร้าเดียวพร้อมกัน ได้แถวเดียว ทั้งสองคืนเซสชันเดียวกัน')` `Promise.all` ของ `add` สองตัว id ต่างกัน คาด `created` เป็น `[true, false]` ไม่สนลำดับ, `session.id` เท่ากันทั้งสอง, `SELECT count(*)` = 1
  - application: `it('AC13: สองคำขอพร้อมกันได้ created หนึ่งครั้ง')` ด้วย `Promise.all` บน fake
- [ ] **Step 2: รัน** คาด FAIL: `duplicate key value violates unique constraint "voice_sessions_cart_id_key"`
- [ ] **Step 3: เขียนโค้ด** `INSERT ... ON CONFLICT (cart_id) DO NOTHING RETURNING ...` ถ้าไม่ได้แถวกลับ ให้ `findByCartId` แล้วคืน `created: false`
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC13: keep one voice session per cart under concurrent consent`

### Task 14: AC14 ห้าม AI Studio กับ production

**Files:** Create: `src/modules/voice/voice-config.ts`; Modify: `src/main.ts`, `docker-compose.yml` (service `api` เพิ่ม `APP_ENV: development`, `VOICE_ENABLED`, `VOICE_PROVIDER: ai-studio`, `VOICE_MODEL: gemini-3.8-live`, `GEMINI_API_KEY: ${GEMINI_API_KEY:-}`, `KIOSK_ID: kiosk-1`, `VOICE_CONSENT_PATH: /app/data/voice-consent.json`); Test: `src/modules/voice/__tests__/voice-config.test.ts`

ค่าเริ่มต้น: `APP_ENV=development`, `VOICE_ENABLED=true`, `VOICE_PROVIDER=ai-studio`, `VOICE_MODEL=gemini-3.8-live`, `KIOSK_ID=kiosk-1`, `VOICE_CONSENT_PATH=data/voice-consent.json`

- [ ] **Step 1: เทสต์ที่ fail**
  - `it('AC14: APP_ENV=production กับ VOICE_PROVIDER=ai-studio → throw ห้ามใช้ AI Studio กับ production')` คาดข้อความมี `ห้ามใช้ AI Studio กับ production`
  - `it('AC14: APP_ENV=production โดยไม่ตั้ง VOICE_PROVIDER → throw')` (ค่าเริ่มต้นเป็น ai-studio)
  - `it('AC14: VOICE_PROVIDER=vertex → throw ยังไม่รองรับ')` (vertex adapter ยังไม่อยู่ในขอบเขต UC-02)
  - `it('AC14: development + ai-studio + มี key → enabled')` คาด `{ enabled: true, model: 'gemini-3.8-live', kioskId: 'kiosk-1' }`
  - `it('AC10: VOICE_ENABLED=false → enabled false')`
- [ ] **Step 2: รัน** คาด FAIL: module not found
- [ ] **Step 3: เขียนโค้ด** `loadVoiceConfig` และใน `main.ts` เรียกก่อนสร้าง pool ถ้า throw ให้ `console.error` แล้ว `process.exit(1)` ส่วน gateway: `config.enabled ? new AiStudioVoiceGateway({ tokens: new GoogleGenAI({ apiKey }).authTokens, model }) : unavailableVoiceGateway`
- [ ] **Step 4: รัน** `npm test` ผ่าน แล้วลองจริง `APP_ENV=production npm start` ต้องจบด้วย exit code 1 และข้อความ AC14
- [ ] **Step 5: Commit** `UC-02 AC14: refuse to start with AI Studio in production`

### Task 15: AC15 ไม่มี API key

**Files:** Modify: `voice-config.ts`, `main.ts`; Test: `voice-config.test.ts`, voice `routes.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - `it('AC15: ai-studio แต่ไม่มี GEMINI_API_KEY → เริ่มได้ แต่ enabled false พร้อม disabledReason')`
  - route: `it('AC15: ใช้ unavailableVoiceGateway ขอข้อความยินยอมหรือยินยอมได้ 503 แต่ POST /carts ยังได้ 201')` เทสต์นี้ไม่ใช้ `createApp` เพราะ `createApp` ต้องมี DB ให้ต่อ router ของ ordering (`InMemoryOrdering`) และ voice (`unavailableVoiceGateway`) เข้า express ตัวเดียวกันในเทสต์
- [ ] **Step 2: รัน** คาด FAIL: enabled เป็น true
- [ ] **Step 3: เขียนโค้ด** ไม่มี key → `enabled: false, disabledReason: 'ไม่มี GEMINI_API_KEY'` และ `main.ts` `console.warn` เหตุผล
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-02 AC15: start with voice off when the Gemini API key is missing`

### Task 16: E2E และเอกสาร

**Files:** Create: `tests/e2e/start-voice-session.test.ts`; Modify: `docs/architecture/context-map.md` (เพิ่มกฎตัวเลข `VOICE_CONNECTION` และแถว `CartAvailability` ← `ordering/index.ts` ให้ตรงชื่อจริง)

- [ ] **Step 1: เทสต์** `it('AC2, AC4, AC8: เริ่มตะกร้า → ข้อความยินยอม → ยินยอม 201 → กดซ้ำ 200 → ยืนยันออเดอร์ → ยินยอมอีก 409')` ใช้ Postgres จริง, `data/voice-consent.json` จริง, `FakeVoiceGateway` และ `fixedClock('2026-10-20T02:30:00Z')` ทุก response ผ่าน `expectMatchesSpec` และสุดท้าย `SELECT count(*) FROM voice_sessions` = 1
- [ ] **Step 2: รัน** `npm test`, `npm run lint`, `npm run typecheck` ผ่านทั้งหมด
- [ ] **Step 3: Commit** `UC-02 AC2, AC4, AC8: end-to-end voice consent across ordering`
