# UC-04 หน้าจอตู้และหน้าสถานะออเดอร์บนมือถือ — แผนงาน

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ทุก subagent ต้องได้ `AGENTS.md` และ `.claude/skills/ddd-architecture/SKILL.md` ไปด้วย

**Goal:** ลูกค้าสั่งเครื่องดื่มที่จอตู้ได้ทั้งแตะและพูด ยืนยันแล้วได้หมายเลขคิวพร้อม QR ที่เปิดหน้าสถานะบนมือถือ (คิว รายการ ยอด)

**Architecture:** ฝั่ง `api` เพิ่มของเล็กน้อยตามชั้น DDD: route `GET /menu` ใน context `menu` (crud), use case `GetOrder` + `GET /orders/{orderId}` + `statusPageUrl` ใน `ordering`, เปิดคำบรรยายในโทเคนของ `voice` และให้ `api` เสิร์ฟไฟล์ static ของ UI ฝั่ง UI เป็นแอป Next.js แยกใน `kiosk/` (static export ไม่มี server) แบ่งเป็น `lib/` (API client, การส่งต่อ function call, แปลงข้อความจาก Gemini Live, PCM) ที่เทสต์แบบฟังก์ชันล้วน และ `components/` ที่เทสต์ด้วย Testing Library โดยใช้ API ปลอมกับ `VoiceLink` ปลอม การต่อ Gemini Live จริงอยู่หลัง interface `VoiceLink` ตัวเดียว

**Tech Stack:** ฝั่ง api เดิม (TypeScript, Express 5, pg, Vitest, Testcontainers, supertest, `@google/genai` 2.30.0) · ฝั่ง UI: `next` 16.4.2, `react`/`react-dom` 19.3.1, `qrcode.react` 4.2.0, `@google/genai` 2.30.0, Vitest + `jsdom` 30.1.3 + `@testing-library/react` 16.3.3 + `@testing-library/user-event` 14.6.8 + `@vitejs/plugin-react` 6.1.2 (ติดตั้งแบบ exact version)

**Spec:** `docs/usecases/UC-04-kiosk-screen.md` (R1–R12, AC1–AC29), `openapi.yaml` (`/menu`, `/orders/{orderId}`, `Order.statusPageUrl`), `docs/architecture/context-map.md`, UC-01–UC-03

## Global Constraints
- KEY `UC-04` หนึ่ง AC ต่อหนึ่ง commit ข้อความ `UC-04 AC<n>: ...` ลงท้ายด้วย `Co-Authored-By` ของ model ที่เขียน commit
- ชื่อเทสต์ขึ้นต้นด้วย `AC<n>: ` ห้ามลบหรือเปลี่ยนชื่อเทสต์เดิมของ UC-01–UC-03 (แก้ได้แค่ตัวที่ต้องส่งพารามิเตอร์เพิ่ม)
- ทุก response ของ `api` ตรวจด้วย `expectMatchesSpec` repository เทสต์กับ Postgres จริง
- error code ใหม่ตัวเดียว: `ORDER_NOT_FOUND` 404 ข้อความ `ไม่พบออเดอร์`
- `statusPageUrl` = `PUBLIC_BASE_URL` (ตัด `/` ท้ายออก) + `/q/?order=<orderId>` ค่าเริ่มต้น `http://localhost:3000`
- `CustomerOrder` ไม่มี `cartId` และ `idempotencyKey` (R10)
- UI ไม่คิดราคาเองและไม่ตรวจกฎตะกร้าเอง ยอดและรายการมาจาก response เท่านั้น ข้อความ error แสดง `message` จาก body ของ API (R1)
- ข้อความบนจอ (คัดลอกตรงตัว): `เริ่มสั่ง`, `ใส่ตะกร้า`, `🎤 สั่งด้วยเสียง`, `⏹ หยุดเสียง`, `ยืนยัน`, `ยืนยันสั่ง`, `กลับไปแก้`, `ยินยอม`, `ไม่ใช่ตอนนี้`, `เสร็จสิ้น`, `หมด`, `หมายเลขคิวของคุณ`, `ยังสั่งอยู่ไหม`, `ยังสั่งอยู่`, `ใช้เสียงไม่ได้ตอนนี้ สั่งด้วยการแตะได้เลย`, `กรุณาเลือก<ชื่อกลุ่ม>`, `รับออเดอร์แล้ว`, `ไม่พบออเดอร์`
- เวลา (`kiosk/lib/timing.ts`): `IDLE_PROMPT_MS = 120_000`, `IDLE_RESET_MS = 15_000`, `QUEUE_RETURN_MS = 30_000`
- คำบรรยายไม่ส่งไป `api` และไม่เก็บใน storage (R6) ไม่มี migration ใหม่
- UI ห้ามเก็บ API key ใดๆ ใช้แค่ `connection.token` จาก `POST /voice/sessions`
- red: `npx vitest run <file> > .superpowers/sdd/UC-04-kiosk-screen/task-<N>-red-<AC>.log 2>&1` (ฝั่ง UI ใช้ `npm --prefix kiosk exec vitest run <file>`) แล้วอ่านด้วย Read

## Review Focus
1. **`PUBLIC_BASE_URL` มี `/` ท้าย** (`https://demo.example.com/`) ต้องได้ `https://demo.example.com/q/?order=...` ไม่ใช่ `//q/` → Task 5
2. **กด "ยืนยันสั่ง" แล้วเน็ตช้าจนกดซ้ำ หรือ checkout ล้มแล้วกดใหม่** ต้องใช้ `Idempotency-Key` เดิมของหน้ายืนยันนั้น ได้ออเดอร์เดียว → Task 13, Task 14
3. **Gemini ส่ง function call หลายตัวในข้อความเดียว** ต้องส่งต่อทีละตัวตามลำดับและตอบครบทุก `id` → Task 21
4. **ตะกร้าหมดอายุระหว่างเปิดเสียง** function call ได้ 409 `CART_EXPIRED` ต้องส่ง body ให้ Gemini (ไม่ใช่ปิดเสียง) → Task 21
5. **ลูกค้ากลับหน้าต้อนรับขณะเปิดเสียง (หมดเวลา หรือหน้าคิว)** ต้องปิดการเชื่อมต่อและไมโครโฟนเสมอ → Task 25

---

## Interfaces กลาง (ฝั่ง UI)

```ts
// kiosk/lib/types.ts — ตรงกับ schema ใน openapi.yaml (เขียนเอง ไม่ generate)
export type Money = { amount: string; currency: 'THB' };
export type MenuItem = { id: string; name: string; basePrice: Money; available: boolean; optionGroups: MenuOptionGroup[] };
export type MenuOptionGroup = { id: string; name: string; required: boolean; choices: { id: string; name: string; priceDelta: Money }[] };
export type Cart = { id: string; status: 'OPEN' | 'CHECKED_OUT'; expiresAt: string; lines: CartLine[]; totalCups: number; total: Money };
export type CartLine = { id: string; menuItemId: string; name: string; options: ChosenOption[]; quantity: number; unitPrice: Money; lineTotal: Money };
export type ChosenOption = { choiceId: string; groupName: string; name: string; priceDelta: Money };
export type OrderLine = Omit<CartLine, 'id'>;
export type Order = { id: string; cartId: string; status: 'PLACED'; queueNumber: number; placedAt: string; lines: OrderLine[]; total: Money; statusPageUrl: string };
export type CustomerOrder = Omit<Order, 'cartId' | 'statusPageUrl'>;
export type VoiceSession = { id: string; cartId: string; consentTextVersion: string; consentedAt: string; connection: { token: string; model: string; startBefore: string } };
export type VoiceFunctionResult = { action: 'SHOW_CART' | 'SHOW_CHECKOUT'; cart: Cart };
export type ApiErrorBody = { code: string; message: string; details?: Record<string, unknown> };

// kiosk/lib/api.ts
export class ApiError extends Error { constructor(readonly status: number, readonly body: ApiErrorBody) }
export interface KioskApi {
  getMenu(): Promise<{ items: MenuItem[] }>;
  startCart(): Promise<Cart>;
  addLine(cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }): Promise<Cart>;
  changeQuantity(cartId: string, lineId: string, quantity: number): Promise<Cart>;
  removeLine(cartId: string, lineId: string): Promise<Cart>;
  checkout(cartId: string, idempotencyKey: string): Promise<Order>;
  getOrder(orderId: string): Promise<CustomerOrder>;
  getConsentText(): Promise<{ version: string; text: string }>;
  startVoiceSession(cartId: string, consentTextVersion: string): Promise<VoiceSession>;
  /** คืน status + body ทุกกรณี ไม่ throw ตาม status (ใช้ส่งต่อให้ Gemini) */
  callVoiceFunction(sessionId: string, call: { name: string; args: Record<string, unknown> }): Promise<{ status: number; body: unknown }>;
}
export function createApi(baseUrl?: string, fetchImpl?: typeof fetch): KioskApi; // baseUrl ค่าเริ่มต้น '' (origin เดียวกัน)

// kiosk/lib/voice-link.ts
export type FunctionCall = { id: string; name: string; args: Record<string, unknown> };
export interface VoiceLinkHandlers {
  onFunctionCalls(calls: FunctionCall[]): void;
  onTranscript(role: 'user' | 'model', text: string): void;
  onClose(reason: 'closed' | 'error'): void;
}
export interface VoiceLinkSession {
  sendFunctionResponses(responses: { id: string; name: string; response: unknown }[]): void;
  close(): void;
}
export interface VoiceLink { connect(connection: VoiceSession['connection'], handlers: VoiceLinkHandlers): Promise<VoiceLinkSession> }

// kiosk/components/Kiosk.tsx
export function Kiosk(props: { api: KioskApi; voice: VoiceLink; newIdempotencyKey?: () => string }): JSX.Element;
// kiosk/components/OrderStatus.tsx
export function OrderStatus(props: { api: KioskApi; orderId: string | null }): JSX.Element;
```

เทสต์ UI ใช้ `kiosk/__tests__/support/fake-api.ts`: `fakeApi(overrides?: Partial<KioskApi>): KioskApi & { calls: Record<string, unknown[][]> }` ค่าเริ่มต้นตอบเมนูเดโม (ลาเต้ อเมริกาโน่ เอสเพรสโซ่ มัทฉะลาเต้หมด ตาม `data/menu.json`) และตะกร้าในหน่วยความจำ และ `kiosk/__tests__/support/fake-voice-link.ts`: `fakeVoiceLink()` คืน `{ link: VoiceLink; handlers(): VoiceLinkHandlers; responses: unknown[][]; closed: boolean; connections: number }`

---

## PR 1: API (Task 1–6)

### Task 1: `GET /menu` (AC1)
**Files:** Create `src/shared/money-json.ts`, `src/modules/menu/menu-routes.ts`, `src/modules/menu/__tests__/menu-routes.test.ts` · Modify `src/modules/ordering/interface/http/mapper.ts` (ย้าย `money()` ไป shared แล้ว import กลับ), `src/modules/menu/index.ts`, `src/app.ts`
**Interfaces:** Produces `money(satang: number): Money` จาก `src/shared/money-json.ts` · `menuRoutes(menu: { all(): Promise<MenuItem[]> }): Router` export จาก `menu/index.ts`
- [ ] Step 1: เทสต์ `AC1: GET /menu ตอบทุกเมนูพร้อมราคาบาท ตัวเลือก และมัทฉะลาเต้หมด` ใช้ `JsonMenuRepository.load('data/menu.json')` + supertest: status 200, `items.map(i => i.id)` = `['latte','americano','espresso','cocoa','matcha-latte']`, latte `basePrice` = `{ amount: '55.00', currency: 'THB' }`, กลุ่ม `size` `required: true` ตัวเลือก `size-l` `priceDelta.amount` = `'10.00'`, matcha-latte `available: false`, `expectMatchesSpec('get', '/menu', res)`
- [ ] Step 2: รัน → FAIL 404 (ยังไม่มี route)
- [ ] Step 3: เขียน `menuRoutes` (แปลง `basePriceSatang`/`priceDeltaSatang` ด้วย `money()`) ต่อสายใน `createApp` ก่อน `errorHandler`
- [ ] Step 4: `npx vitest run src/modules/menu src/modules/ordering` → PASS
- [ ] Step 5: commit `UC-04 AC1: GET /menu สำหรับหน้าจอตู้`

### Task 2: อ่านออเดอร์ตาม id (AC2)
**Files:** Modify `src/modules/ordering/domain/repositories.ts`, `src/modules/ordering/infrastructure/pg-order-repository.ts`, `src/modules/ordering/application/__tests__/fakes.ts`, `src/modules/ordering/interface/http/{routes.ts,mapper.ts}`, `src/modules/ordering/module.ts` · Create `src/modules/ordering/application/get-order.ts` · Test `application/__tests__/get-order.test.ts`, `infrastructure/__tests__/pg-ordering.test.ts`, `interface/http/__tests__/routes.test.ts`
**Interfaces:** Produces `OrderRepository.findById(id: string): Promise<Order | null>` · `class GetOrder { constructor(deps: { uow: UnitOfWork }); execute(orderId: string): Promise<Order> }` · `toCustomerOrderJson(order: Order)` (เหมือน `toOrderJson` แต่ไม่มี `cartId`/`statusPageUrl`) · `OrderingUseCases.getOrder`
- [ ] Step 1: เทสต์ 3 ชั้น
  - application `AC2: GetOrder คืนออเดอร์ที่ยืนยันแล้ว` (fake uow, ยืนยันลาเต้ L นมโอ๊ต 2 แก้วก่อน) → `queueNumber.value` 1, `lines[0].quantity` 2, `total.satang` 16000
  - infra `AC2: findById คืนออเดอร์พร้อมรายการตามลำดับ` ใช้ `placeOrder(...)` เดิมในไฟล์ → ได้ `toState()` เท่ากับที่บันทึก และ `findById(id(999))` = `null`
  - http `AC2: GET /orders/{orderId} ตอบคิว รายการ ยอด ไม่มี cartId` → 200, `queueNumber` 1, `total.amount` `'160.00'`, `res.body` ไม่มี key `cartId`, `expectMatchesSpec('get', '/orders/{orderId}', res)`
- [ ] Step 2: รัน → FAIL (`findById is not a function` / 404 route)
- [ ] Step 3: `PgOrderRepository`: แยก query เดิมเป็น private `findOne(where: 'id' | 'idempotency_key', value)` ใช้ทั้งสองเมธอด · `GetOrder` โยน `DomainError('ORDER_NOT_FOUND')` เมื่อไม่พบ · route `GET /orders/:orderId`
- [ ] Step 4: `npx vitest run src/modules/ordering` → PASS (ยกเว้นเทสต์ checkout 2 ตัวที่รอ Task 4)
- [ ] Step 5: commit `UC-04 AC2: อ่านออเดอร์สำหรับหน้าสถานะบนมือถือ`

### Task 3: ไม่พบออเดอร์ (AC3)
**Files:** Modify `src/shared/http-errors.ts`, `src/modules/ordering/interface/http/routes.ts` · Test `routes.test.ts`
- [ ] Step 1: `AC3: GET /orders/{orderId} id ที่ไม่มีหรือไม่ใช่ uuid ตอบ 404 ORDER_NOT_FOUND` สองคำขอ: `c0000000-0000-4000-8000-00000000dead` และ `not-a-uuid` → 404, `code` `ORDER_NOT_FOUND`, `message` `ไม่พบออเดอร์`, ตรง spec
- [ ] Step 2: รัน → FAIL (500 เพราะ code ไม่อยู่ใน `ERRORS` / Postgres ปฏิเสธ uuid)
- [ ] Step 3: เพิ่ม `ORDER_NOT_FOUND: { status: 404, message: 'ไม่พบออเดอร์' }` และ `orderIdOf(req)` ตรวจ `UUID` แบบเดียวกับ `cartIdOf`
- [ ] Step 4: PASS · Step 5: commit `UC-04 AC3: ตอบ ORDER_NOT_FOUND เมื่อไม่พบออเดอร์`

### Task 4: `statusPageUrl` ใน checkout (AC4)
**Files:** Modify `src/modules/ordering/interface/http/{mapper.ts,routes.ts}`, `src/modules/ordering/module.ts`, `src/app.ts`, `src/main.ts`, `docker-compose.yml` (`PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-http://localhost:3000}`) · Test `routes.test.ts`
**Interfaces:** `createOrderingModule(deps & { publicBaseUrl?: string })` · `createApp({ ..., publicBaseUrl?: string })` · `statusPageUrl(baseUrl: string, orderId: string): string` ใน mapper · `toOrderJson(order, baseUrl)`
- [ ] Step 1: `AC4: checkout ตอบ statusPageUrl จาก PUBLIC_BASE_URL ทั้งตอนสร้างและยืนยันซ้ำ` สร้าง module ด้วย `publicBaseUrl: 'https://demo.example.com'` → 201 และ 200 (key เดิม) มี `statusPageUrl` = `` `https://demo.example.com/q/?order=${res.body.id}` `` ตรง spec
- [ ] Step 2: รัน → FAIL (`statusPageUrl` undefined) — เทสต์ checkout เดิม 5 ตัวก็ fail ด้วยเหตุผลเดียวกันตั้งแต่ commit spec
- [ ] Step 3: main อ่าน `PUBLIC_BASE_URL` ส่งต่อเฉพาะเมื่อตั้งไว้
- [ ] Step 4: `npm test` → PASS ทั้งหมด (236 เดิม + ใหม่) · Step 5: commit `UC-04 AC4: ใส่ statusPageUrl ใน response ของ checkout`

### Task 5: ค่าเริ่มต้นและ `/` ท้าย (AC5)
**Files:** Modify `src/modules/ordering/module.ts` (`DEFAULT_PUBLIC_BASE_URL = 'http://localhost:3000'`), `mapper.ts` · Test `routes.test.ts`
- [ ] Step 1: `AC5: ไม่ตั้ง PUBLIC_BASE_URL ได้ลิงก์ localhost:3000` → `statusPageUrl` เริ่มด้วย `http://localhost:3000/q/?order=` · และ `AC5: PUBLIC_BASE_URL มี / ท้ายไม่เกิด //` (`'https://demo.example.com/'` → `https://demo.example.com/q/?order=…`)
- [ ] Step 2: FAIL · Step 3: ใช้ค่าเริ่มต้นใน module และตัด `/+$` ใน `statusPageUrl` · Step 4: PASS · Step 5: commit `UC-04 AC5: ค่าเริ่มต้นของลิงก์หน้าสถานะ`

### Task 6: ล็อกคำบรรยายในโทเคน (AC6)
**Files:** Modify `src/modules/voice/infrastructure/ai-studio-voice-gateway.ts` · Test `infrastructure/__tests__/ai-studio-voice-gateway.test.ts` (เพิ่ม field ใน `SentConfig`)
- [ ] Step 1: `AC6: ล็อกคำบรรยายขาเข้าและขาออก ส่วนอื่นไม่เปลี่ยน` → `config.inputAudioTranscription` = `{}`, `config.outputAudioTranscription` = `{}`, และ `responseModalities`, `sessionResumption`, `speechConfig` เท่าเดิม
- [ ] Step 2: FAIL (`undefined`) · Step 3: เพิ่มสอง field ใน `liveConnectConstraints.config` · Step 4: `npx vitest run src/modules/voice` PASS (รวมเทสต์ AC7 ของ UC-02 ที่ตรวจว่าไม่มีคำว่า `cart`/`name":`) · Step 5: commit `UC-04 AC6: เปิดคำบรรยายในโทเคน Gemini Live`

## PR 2: UI สั่งด้วยการแตะ คิว และหน้าสถานะ (Task 7–18)

### Task 7: โครง `kiosk/` และ `api` เสิร์ฟ static (AC7)
**Files:** Create `kiosk/package.json` (scripts: `dev`=`next dev -p 3001`, `build`=`next build`, `test`=`vitest run`, `typecheck`=`tsc --noEmit`), `kiosk/next.config.mjs`, `kiosk/tsconfig.json`, `kiosk/vitest.config.ts` (environment `jsdom`, plugin react), `kiosk/app/layout.tsx` (`lang="th"`), `kiosk/app/page.tsx`, `kiosk/app/q/page.tsx` (placeholder), `kiosk/lib/{types.ts,api.ts}`, `kiosk/__tests__/api.test.ts`, `tests/e2e/kiosk-static.test.ts`, `tests/fixtures/kiosk-out/{index.html,q/index.html}` · Modify `src/app.ts` (`kioskDir?: string` → `express.static(kioskDir)` หลัง router ก่อน `errorHandler`), `src/main.ts` (`KIOSK_DIR` ค่าเริ่มต้น `kiosk/out` ใช้เมื่อโฟลเดอร์มีอยู่), `Dockerfile` (stage `kiosk` รัน `npm ci && npm run build` ใน `kiosk/` แล้ว copy `kiosk/out`), `.dockerignore` (`kiosk/node_modules`, `kiosk/.next`, `kiosk/out`), `.gitignore` (`kiosk/.next/`, `kiosk/out/`), `eslint.config.js` ignores (`kiosk/.next/**`, `kiosk/out/**`, `kiosk/next-env.d.ts`), root `package.json` (`"test": "vitest run && npm --prefix kiosk test"`), `.github/workflows/ci.yml` (`npm ci --prefix kiosk`, `npm --prefix kiosk run typecheck`, `npm --prefix kiosk run build`)
**Interfaces:** Produces `createApi`, `ApiError`, types ทั้งหมดใน Interfaces กลาง · `next.config.mjs` ส่งออกฟังก์ชันตาม phase: build → `{ output: 'export', trailingSlash: true }`; dev → เพิ่ม `rewrites` ของ `/menu`, `/carts/:path*`, `/orders/:path*`, `/voice/:path*` ไป `http://127.0.0.1:3000`
- [ ] Step 1: เทสต์
  - `tests/e2e/kiosk-static.test.ts` `AC7: api เสิร์ฟหน้าตู้ หน้าสถานะ และ API เดิมจาก origin เดียวกัน` (createApp กับ `kioskDir` = fixture, Postgres จริง) → `GET /` 200 `text/html` มีข้อความจาก fixture, `GET /q/?order=x` 200 จาก `q/index.html`, `POST /carts` ยัง 201 ตรง spec
  - `kiosk/__tests__/api.test.ts` `AC7: createApi ส่ง path และ header ตาม spec และโยน ApiError พร้อม body` ด้วย `fetchImpl` ปลอม: `checkout('c1','k1')` เรียก `POST /carts/c1/checkout` header `Idempotency-Key: k1`; ตอบ 409 `{code:'CART_EMPTY',message:'ตะกร้ายังว่าง'}` → `ApiError` `status` 409 `body.code` `CART_EMPTY`; `callVoiceFunction` ตอบ 404 → resolve `{ status: 404, body }` ไม่ throw
- [ ] Step 2: FAIL (404 / module not found) · Step 3: ทำตาม Files · Step 4: `npm test` และ `npm --prefix kiosk run build` ผ่าน มี `kiosk/out/index.html` และ `kiosk/out/q/index.html` · Step 5: commit `UC-04 AC7: โครง Next.js และ api เสิร์ฟหน้าตู้`

### Task 8: หน้าต้อนรับ → หน้าสั่ง (AC8)
**Files:** Create `kiosk/components/{Kiosk.tsx,WelcomeScreen.tsx,OrderScreen.tsx,MenuGrid.tsx,CartPanel.tsx}`, `kiosk/__tests__/support/{fake-api.ts,fake-voice-link.ts}`, `kiosk/__tests__/order-touch.test.tsx` · Modify `kiosk/app/page.tsx` (`'use client'` render `<Kiosk api={createApi()} voice={geminiVoiceLink} />` — ระหว่าง PR 2 ใช้ `VoiceLink` ที่ connect แล้ว reject ไปก่อน)
- [ ] Step 1: `AC8: แตะเริ่มสั่งสร้างตะกร้าหนึ่งใบและแสดงทุกเมนู มัทฉะลาเต้หมดแตะไม่ได้` → `calls.startCart.length` 1, เห็นชื่อทุกเมนูและราคา `55.00`, ปุ่มมัทฉะลาเต้ `disabled` และมีคำว่า `หมด`
- [ ] Step 2: FAIL · Step 3: `Kiosk` ถือ state `screen: 'welcome' | 'order' | 'confirm' | 'queue'`, `cart`, `menu` · Step 4: PASS · Step 5: commit `UC-04 AC8: หน้าต้อนรับและหน้าสั่ง`

### Task 9: หน้าต่างตัวเลือกและใส่ตะกร้า (AC9)
**Files:** Create `kiosk/components/ItemOptionsDialog.tsx` · Test `order-touch.test.tsx`
- [ ] Step 1: `AC9: เลือกลาเต้ L นมโอ๊ต 2 แก้วแล้วใส่ตะกร้า ตะกร้าแสดงตาม response` → `calls.addLine[0]` = `[cartId, { menuItemId: 'latte', optionChoiceIds: ['size-l','milk-oat'], quantity: 2 }]`, ตะกร้าแสดง `ลาเต้`, `L`, `นมโอ๊ต`, `x2`, ยอด `160.00` (ยอดจาก fake ที่ตอบตามตัวอย่าง `CartWithLatte`)
- [ ] Step 2–5 ตามรูปแบบเดิม · กลุ่มแบบไม่บังคับเลือกได้ไม่เกินหนึ่งตัวเลือก จำนวน 1–10 · commit `UC-04 AC9: เลือกตัวเลือกและใส่ตะกร้า`

### Task 10: ตัวเลือกบังคับ (AC10)
- [ ] `AC10: อเมริกาโน่ยังไม่เลือกขนาด แตะใส่ตะกร้าไม่ส่งคำขอและแจ้งให้เลือกขนาด` → `calls.addLine.length` 0, เห็น `กรุณาเลือกขนาด` · commit `UC-04 AC10: แจ้งตัวเลือกที่ต้องเลือก`

### Task 11: แก้จำนวนและลบ (AC11)
- [ ] `AC11: แตะ + เป็น 3 แล้วลบ ส่งคำขอและแสดงตาม response ทุกครั้ง` → `calls.changeQuantity[0]` = `[cartId, lineId, 3]`, จอแสดง `x3`, แล้ว `calls.removeLine[0]` = `[cartId, lineId]` ตะกร้าว่าง · ปุ่ม − ที่จำนวน 1 ไม่ส่งคำขอ (ใช้ลบแทน) · commit `UC-04 AC11: แก้จำนวนและลบรายการในตะกร้า`

### Task 12: แสดง error จาก API (AC12)
- [ ] `AC12: API ตอบ 409 CART_LIMIT_REACHED แสดงข้อความของ API ตะกร้าบนจอไม่เปลี่ยน` (fake `addLine` reject `new ApiError(409, { code: 'CART_LIMIT_REACHED', message: 'ตะกร้ามีได้ไม่เกิน 20 แก้ว' })`) → เห็นข้อความนั้น ตะกร้ายังเป็นค่าเดิม · error ที่ไม่ใช่ `ApiError` แสดง `ระบบขัดข้อง กรุณาติดต่อพนักงาน` · commit `UC-04 AC12: แสดงข้อความ error จาก API`

### Task 13: หน้ายืนยัน หน้าคิว และ QR (AC23)
**Files:** Create `kiosk/components/{ConfirmScreen.tsx,QueueScreen.tsx}`, `kiosk/__tests__/checkout.test.tsx`
- [ ] Step 1: `AC23: ยืนยันสั่งสองครั้งเร็วๆ ใช้ key เดียว ได้คิวและ QR ของ statusPageUrl` → `calls.checkout` ทุกครั้งมี key เดียวกัน (`newIdempotencyKey` ปลอมคืน `'k-1'`, `'k-2'` ตามลำดับ ต้องเห็นแค่ `'k-1'`), จอแสดง `หมายเลขคิวของคุณ` และ `17`, มี `svg` ของ QR ที่ `title` = `statusPageUrl` (ส่ง `title` ให้ `QRCodeSVG`)
- [ ] Step 2–5 · ปุ่ม "ยืนยันสั่ง" disabled ระหว่างรอ · key สร้างตอนเข้าหน้ายืนยัน ใช้ซ้ำจนกว่าจะออกจากหน้านั้น · QR ใช้ `QRCodeSVG` จาก `qrcode.react` · commit `UC-04 AC23: ยืนยันออเดอร์และแสดงคิวพร้อม QR`

### Task 14: ยืนยันไม่ผ่านเพราะเมนูหรือราคา (AC24)
- [ ] `AC24: checkout ได้ PRICE_CHANGED กลับหน้าสั่ง แสดงข้อความ และแสดงตะกร้าใหม่จาก details` → กลับหน้าสั่ง เห็น `ราคามีการเปลี่ยนแปลง กรุณาตรวจยอดใหม่` ยอดเป็นของ `details.cart` · `AC24: MENU_ITEM_UNAVAILABLE ไฮไลต์รายการตาม details.lineIds` → แถวนั้นมี `data-problem="true"` · `AC24: กดยืนยันใหม่หลัง checkout ล้ม ใช้ key ใหม่เพราะเข้าหน้ายืนยันใหม่` (Review Focus 2: ภายในหน้าเดิมใช้ key เดิม) · commit `UC-04 AC24: จัดการเมนูหมดและราคาเปลี่ยนตอนยืนยัน`

### Task 15: ตะกร้าหมดอายุ (AC25)
- [ ] `AC25: checkout ได้ CART_EXPIRED แสดงข้อความแล้วกลับหน้าต้อนรับ` → เห็น `ตะกร้าหมดอายุ กรุณาเริ่มสั่งใหม่` แล้วเห็นปุ่ม `เริ่มสั่ง` (ข้อความค้าง 3 วินาทีด้วย fake timers) · ใช้กฎเดียวกันเมื่อ `addLine`/`changeQuantity`/`removeLine` ได้ `CART_EXPIRED` · commit `UC-04 AC25: ตะกร้าหมดอายุกลับหน้าต้อนรับ`

### Task 16: หน้าคิวกลับเอง (AC26)
**Files:** Create `kiosk/lib/timing.ts`
- [ ] `AC26: หน้าคิวกลับหน้าต้อนรับหลัง 30 วินาที หรือเมื่อแตะเสร็จสิ้น` (`vi.useFakeTimers({ shouldAdvanceTime: true })`, userEvent `advanceTimers: vi.advanceTimersByTime`) → ที่ 29,999 ms ยังเห็นคิว ที่ 30,000 ms เห็น `เริ่มสั่ง` · แตะ `เสร็จสิ้น` กลับทันที · เริ่มสั่งใหม่ได้ตะกร้าใหม่ (`calls.startCart.length` 2) · commit `UC-04 AC26: หน้าคิวกลับหน้าต้อนรับเอง`

### Task 17: ถามว่ายังสั่งอยู่ไหม (AC27)
**Files:** Create `kiosk/components/IdlePrompt.tsx`, `kiosk/lib/use-idle.ts` (`useIdle(onIdle: () => void, ms: number, enabled: boolean)` รีเซ็ตเมื่อ `pointerdown`)
- [ ] `AC27: ไม่แตะ 2 นาทีถาม ยังสั่งอยู่ไหม แล้วอีก 15 วินาทีกลับหน้าต้อนรับ` → ที่ 120,000 ms เห็น `ยังสั่งอยู่ไหม` ที่ +15,000 ms เห็น `เริ่มสั่ง` · `AC27: แตะ ยังสั่งอยู่ ระหว่าง 15 วินาที อยู่หน้าเดิม` · `AC27: ไม่ถามระหว่างเปิดเสียง` (ทำใน Task 19 เมื่อมีเสียง: เพิ่มเทสต์นี้ตอนนั้น) · ใช้ทั้งหน้าสั่งและหน้ายืนยัน · commit `UC-04 AC27: ถามเมื่อไม่มีการแตะและกลับหน้าต้อนรับ`

### Task 18: หน้าสถานะบนมือถือ (AC28, AC29)
**Files:** Create `kiosk/components/OrderStatus.tsx`, `kiosk/__tests__/order-status.test.tsx` · Modify `kiosk/app/q/page.tsx` (อ่าน `order` จาก `useSearchParams()` ภายใต้ `<Suspense>`)
- [ ] `AC28: แสดงคิว 17 รับออเดอร์แล้ว รายการ และยอด` (fake `getOrder` คืนตัวอย่าง `CustomerOrderQueue17`) → `17`, `รับออเดอร์แล้ว`, `ลาเต้`, `L`, `นมโอ๊ต`, `x2`, `160.00` · commit `UC-04 AC28: หน้าสถานะออเดอร์บนมือถือ`
- [ ] `AC29: ไม่พบออเดอร์หรือไม่มี order ใน URL แสดง ไม่พบออเดอร์` (`orderId: null` ไม่เรียก API; `getOrder` reject `ApiError(404, ORDER_NOT_FOUND)`) · commit `UC-04 AC29: หน้าสถานะเมื่อไม่พบออเดอร์`

## PR 3: UI สั่งด้วยเสียง (Task 19–26)

### Task 19: แผ่นยินยอม (AC13)
**Files:** Create `kiosk/components/ConsentSheet.tsx`, `kiosk/__tests__/order-voice.test.tsx`
- [ ] `AC13: แตะสั่งด้วยเสียงครั้งแรกแสดงข้อความยินยอมจาก API ปุ่มสองปุ่มขนาดเท่ากัน` → เห็น `text` จาก `getConsentText`, ปุ่ม `ยินยอม` และ `ไม่ใช่ตอนนี้` มี `className` เดียวกัน (ขนาดมาจาก class เดียว) · เพิ่มเทสต์ `AC27: ไม่ถามระหว่างเปิดเสียง` ที่ค้างจาก Task 17 ใน Task 21 · commit `UC-04 AC13: แผ่นข้อความยินยอมเรื่องเสียง`

### Task 20: ไม่ยินยอม (AC14)
- [ ] `AC14: แตะ ไม่ใช่ตอนนี้ ปิดแผ่น ไม่เรียก startVoiceSession แตะเมนูต่อได้` · commit `UC-04 AC14: ปิดแผ่นยินยอมโดยไม่เปิดเสียง`

### Task 21: ยินยอม เปิดเสียง และส่งต่อ function call (AC15, AC17)
**Files:** Create `kiosk/lib/voice-relay.ts` (`relayFunctionCalls(api, sessionId, calls: FunctionCall[]): Promise<{ responses: { id; name; response }[]; cart?: Cart; showCheckout: boolean; fatal: boolean }>` ส่งทีละตัวตามลำดับ 200/400/404/409 → `response` = body; 503/500/เน็ตล้ม → `fatal: true` หยุดทันที), `kiosk/__tests__/voice-relay.test.ts`
- [ ] commit แรก `UC-04 AC15: ยินยอมแล้วเปิด Gemini Live` — `AC15: แตะยินยอมส่ง cartId และเวอร์ชันที่แสดง แล้ว connect ด้วยโทเคน ปุ่มเป็นหยุดเสียง` → `calls.startVoiceSession[0]` = `[cartId, 'voice-demo-v1']`, `fake.connections` 1 ด้วย `connection.token`, เห็น `⏹ หยุดเสียง`
- [ ] commit ที่สอง `UC-04 AC17: ส่งต่อ function call ให้ api ตามที่ได้รับ` — `voice-relay.test.ts`: `AC17: ส่งหลาย call ตามลำดับและตอบครบทุก id` (Review Focus 3), `AC17: 409 CART_EXPIRED ส่ง body ให้ Gemini ไม่ fatal` (Review Focus 4), `AC17: 404 และ 400 ส่ง body ให้ Gemini` · `order-voice.test.tsx`: `AC17: add_to_cart จาก Gemini แสดงตะกร้าจาก response` → `fake.responses[0]` = `[{ id: 'fc1', name: 'add_to_cart', response: <body> }]` และจอแสดงยอด `160.00` · เพิ่ม `AC27: ไม่ถามระหว่างเปิดเสียง`

### Task 22: request_checkout (AC18)
- [ ] `AC18: request_checkout ได้ SHOW_CHECKOUT เปิดหน้ายืนยัน ไม่เรียก checkout` → เห็น `ยืนยันสั่ง`, `calls.checkout.length` 0 · commit `UC-04 AC18: เปิดหน้ายืนยันเมื่อ Gemini ขอจ่ายเงิน`

### Task 23: เสียงล้มกลางทาง (AC19, AC20)
- [ ] `AC19: function call ได้ 503 หรือการเชื่อมต่อหลุด ปิดเสียงแสดงข้อความ แตะสั่งต่อได้` สองกรณี (relay `fatal` → `session.close()` ถูกเรียก; `handlers().onClose('error')`) → เห็น `ใช้เสียงไม่ได้ตอนนี้ สั่งด้วยการแตะได้เลย` และ `🎤 สั่งด้วยเสียง` ตะกร้าเดิมยังอยู่ · commit `UC-04 AC19: ปิดเสียงเมื่อเสียงล้มกลางทาง`
- [ ] `AC20: startVoiceSession ได้ 503 ไม่เปิดเสียงและแสดงข้อความ` และ `connect` reject ให้ผลเดียวกัน · commit `UC-04 AC20: เปิดเสียงไม่ได้กลับไปแตะ`

### Task 24: หยุดเสียงและเปิดใหม่ (AC21, AC16)
- [ ] `AC21: แตะหยุดเสียงปิดการเชื่อมต่อ ตะกร้าไม่เปลี่ยน` → `fake.closed` true, ไม่มีคำขอแก้ตะกร้า · commit `UC-04 AC21: ปุ่มหยุดเสียง`
- [ ] `AC16: ยินยอมแล้วแตะเสียงอีกครั้งไม่แสดงแผ่นยินยอม ขอข้อมูลเชื่อมต่อใหม่` → `calls.getConsentText.length` 1, `calls.startVoiceSession.length` 2, `fake.connections` 2 · commit `UC-04 AC16: เปิดเสียงซ้ำโดยไม่ถามยินยอมอีก`

### Task 25: กล่องคำบรรยายและการล้างเมื่อออก (AC22)
**Files:** Create `kiosk/components/CaptionBox.tsx`
- [ ] `AC22: แสดงคำบรรยายของลูกค้าและ Gemini ไม่มีคำขอไป api` → `onTranscript('user','ขอลาเต้แก้วใหญ่')`, `onTranscript('model','ใส่ลาเต้ L ให้แล้วค่ะ')` เห็น `👤 ขอลาเต้แก้วใหญ่` และ `🤖 ใส่ลาเต้ L ให้แล้วค่ะ`; จำนวนคำขอใน `calls` ไม่เพิ่ม · ข้อความต่อเนื่องของคนเดิมต่อท้ายบรรทัดล่าสุด · `AC22: กลับหน้าต้อนรับระหว่างเปิดเสียงปิดการเชื่อมต่อและล้างคำบรรยาย` (Review Focus 5: ผ่านหน้าคิวและผ่าน `CART_EXPIRED`) · commit `UC-04 AC22: กล่องคำบรรยายระหว่างสั่งด้วยเสียง`

### Task 26: ต่อ Gemini Live จริง (AC15)
**Files:** Create `kiosk/lib/live-messages.ts` (`parseLiveMessage(msg: LiveServerMessage): LiveEvent[]` โดย `LiveEvent` = `{ type: 'functionCalls'; calls: FunctionCall[] } | { type: 'transcript'; role: 'user' | 'model'; text: string } | { type: 'audio'; base64: string } | { type: 'interrupted' }`), `kiosk/lib/pcm.ts` (`floatToPcm16Base64(samples: Float32Array): string`, `pcm16Base64ToFloat(base64: string): Float32Array`), `kiosk/lib/gemini-voice-link.ts` (`geminiVoiceLink: VoiceLink`), `kiosk/public/mic-worklet.js` · Test `kiosk/__tests__/live-messages.test.ts`, `kiosk/__tests__/pcm.test.ts` · Modify `kiosk/app/page.tsx` ใช้ `geminiVoiceLink`
- [ ] Step 1: `AC15: parseLiveMessage แยก toolCall คำบรรยาย เสียง และ interrupted` (อ่าน `toolCall.functionCalls`, `serverContent.inputTranscription.text`, `serverContent.outputTranscription.text`, `serverContent.modelTurn.parts[].inlineData.data`, `serverContent.interrupted`) · `AC15: แปลง PCM16 ไปกลับ` (`[0, 0.5, -1]` → base64 → ได้ค่าใกล้เดิม ±1/32768)
- [ ] Step 2: FAIL · Step 3: `geminiVoiceLink.connect`: `new GoogleGenAI({ apiKey: connection.token, httpOptions: { apiVersion: 'v1alpha' } }).live.connect({ model: connection.model, config: { responseModalities: [Modality.AUDIO] }, callbacks })`; ไมโครโฟน `getUserMedia({ audio: true })` → AudioWorklet resample เป็น 16 kHz → `sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } })`; เสียงตอบเล่นที่ 24 kHz ต่อคิว `interrupted` ล้างคิว; `sendToolResponse({ functionResponses })`; `close()` ปิด session, track ไมโครโฟน และ AudioContext
- [ ] Step 4: PASS + `npm --prefix kiosk run build` ผ่าน · ตรวจด้วยคนตามสคริปต์เดโม UC-03 บน `http://localhost:3000` (`docker compose up --build api`) บันทึกผลใน `.superpowers/sdd/UC-04-kiosk-screen/progress.md`
- [ ] Step 5: commit `UC-04 AC15: เชื่อม Gemini Live จริงด้วยเสียงจากไมโครโฟน`

### Task 27: E2E ข้าม use case
**Files:** Create `tests/e2e/kiosk-order-status.test.ts`
- [ ] `AC4, AC28: แตะสั่ง ยืนยัน แล้วเปิดหน้าสถานะจาก statusPageUrl` (createApp จริง Postgres จริง `publicBaseUrl: 'https://demo.example.com'`) → `POST /carts` → `POST lines` ลาเต้ L นมโอ๊ต 2 → checkout → ดึง `order` จาก `new URL(statusPageUrl).searchParams` → `GET /orders/{orderId}` 200 คิวตรงกับ checkout ยอด `160.00` ไม่มี `cartId` ตรง spec · commit `UC-04 AC4, AC28: e2e จากยืนยันออเดอร์ถึงหน้าสถานะ`

## ตรวจก่อนเปิด PR
- `npm run lint`, `npm run typecheck`, `npm --prefix kiosk run typecheck`, `npm test`, `npm --prefix kiosk run build`, `npx -y @redocly/cli@1.25.0 lint openapi.yaml`
- เช็กลิสต์ `ddd-architecture` และ Definition of Done ของ `feature-workflow` รายงานตาราง AC → ไฟล์เทสต์ → สถานะ
