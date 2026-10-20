# UC-03 สั่งเครื่องดื่มด้วยเสียง — แผนงาน

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. ทุก subagent ต้องได้ `AGENTS.md` และ `.claude/skills/ddd-architecture/SKILL.md` ไปด้วย

**Goal:** Gemini สั่งเครื่องดื่มแทนลูกค้าได้ผ่าน function call ที่ตู้ส่งต่อให้เซิร์ฟเวอร์ เซิร์ฟเวอร์ทำกับตะกร้าของเซสชันเสียงด้วยกฎ UC-01 ชุดเดียวกับการแตะจอ และโทเคนของ UC-02 ล็อกคำสั่งระบบ (เมนูปัจจุบัน + ข้อปฏิบัติ) ฟังก์ชัน และภาษา `th-TH`

**Architecture:** ต่อยอด context `voice` (light) เพิ่ม use case `CallVoiceFunction` ที่หาเซสชันจาก `sessionId` → ตรวจตะกร้ายังเปิดด้วย `CartAvailability` เดิม → เรียก port ใหม่ `VoiceCartOperations` ที่ ordering ส่งออกทาง `ordering/index.ts` (หุ้ม use case เดิมของ ordering และ map เป็น JSON ด้วย `toCartJson`) ฝั่งโทเคน `StartVoiceSession` อ่านเมนูผ่าน port ใหม่ `VoiceMenu` สร้างคำสั่งระบบด้วยฟังก์ชัน domain `buildVoiceInstructions` แล้วส่งให้ `VoiceGateway.issueConnection` ซึ่ง adapter ล็อก `systemInstruction`, `tools` และ `speechConfig` ไว้ในโทเคน

**Tech Stack:** TypeScript, Express 5, pg, Vitest, Testcontainers, supertest, `@google/genai` 2.30.0

**Spec:** `docs/usecases/UC-03-voice-ordering.md`, `openapi.yaml` (`/voice/sessions/{sessionId}/function-calls`), `docs/architecture/context-map.md`, UC-01 และ UC-02 ใน `docs/usecases/`

## Global Constraints
- KEY คือ `UC-03` หนึ่ง AC ต่อหนึ่ง commit ข้อความ `UC-03 AC<n>: ...` ลงท้ายด้วยบรรทัด `Co-Authored-By` ของ model ที่เขียน commit นั้น
- ชื่อเทสต์ขึ้นต้นด้วย `AC<n>: ` ทุกตัว เทสต์ของ UC-02 ที่ต้องแก้เพราะ signature เปลี่ยน ห้ามเปลี่ยนชื่อหรือลบ assertion เดิม
- ห้าม `new Date()` / `Date.now()` ใน domain และ application ใช้ `Clock`
- ชื่อฟังก์ชันทั้ง 5: `add_to_cart`, `change_quantity`, `remove_from_cart`, `view_cart`, `request_checkout` (ตรงกับ `openapi.yaml`)
- ผลสำเร็จ 200 `{ action: 'SHOW_CART' | 'SHOW_CHECKOUT', cart }` โดย `cart` ตรง schema `Cart` ของ UC-01
- ตะกร้ามาจากเซสชันเสียงเท่านั้น ไม่รับ `cartId` จาก body (R2)
- `request_checkout` ห้ามสร้างออเดอร์หรือเปลี่ยนสถานะตะกร้า (R3)
- error code ใหม่มีตัวเดียว: `VOICE_SESSION_NOT_FOUND` 404 ข้อความ `ไม่พบเซสชันเสียง` ที่เหลือใช้ของ UC-01
- คำสั่งระบบและคำขอโทเคนต้องไม่มี cartId, kioskId, ชื่อ เบอร์โทร หรือภาพ (UC-02 R7)
- ไม่บันทึกข้อความพูด เสียง หรือประวัติการเรียกฟังก์ชัน ไม่มี migration ใหม่ (R6)
- voice ห้ามเขียนตารางของ ordering ตรงๆ ทุกอย่างผ่าน port
- เทสต์ repository ใช้ Postgres จริง ทุก response ตรวจด้วย `expectMatchesSpec`
- red: `npx vitest run <file> > .superpowers/sdd/UC-03-voice-ordering/task-<N>-red-<AC>.log 2>&1` แล้วอ่านด้วย Read

## Review Focus
1. **ตะกร้าของเซสชันหมดอายุแล้วเรียก `view_cart`** ต้องได้ 409 `CART_EXPIRED` ไม่ใช่ตะกร้าเก่า (`GetCart` ของ ordering ไม่ตรวจหมดอายุ) → Task 12
2. **`args` ไม่ใช่ object (เช่น `null`, array, string)** ต้องได้ 400 ไม่ใช่ 500 → Task 13
3. **`sessionId` ไม่ใช่ uuid** ต้องได้ 404 `VOICE_SESSION_NOT_FOUND` ไม่ใช่ 500 จาก Postgres → Task 11
4. **เมนูที่หมดในคำสั่งระบบ** ต้องระบุว่าหมดชัดเจน และ Gemini ไม่ได้รับ id ที่ไม่มีอยู่ → Task 1
5. **เพิ่มฟังก์ชัน args เกิน (เช่น `cartId` ปลอมใน args)** ต้องไม่ถูกใช้ ตะกร้ายังมาจากเซสชัน → Task 10

---

## Interfaces กลาง

```ts
// voice/domain/voice-menu.ts — มุมมองเมนูของ voice (ไม่ import จาก menu)
export interface VoiceMenuChoice { id: string; name: string; priceDeltaSatang: number }
export interface VoiceMenuGroup { id: string; name: string; required: boolean; choices: VoiceMenuChoice[] }
export interface VoiceMenuItem { id: string; name: string; basePriceSatang: number; available: boolean; optionGroups: VoiceMenuGroup[] }

// voice/domain/voice-instructions.ts
export function buildVoiceInstructions(menu: readonly VoiceMenuItem[]): string; // R4 + R5 ภาษาไทย

// voice/domain/voice-function-call.ts
export type VoiceFunctionCall =
  | { name: 'add_to_cart'; menuItemId: string; optionChoiceIds: string[]; quantity: number }
  | { name: 'change_quantity'; lineId: string; quantity: number }
  | { name: 'remove_from_cart'; lineId: string }
  | { name: 'view_cart' }
  | { name: 'request_checkout' };
export const VOICE_FUNCTION_NAMES = ['add_to_cart', 'change_quantity', 'remove_from_cart', 'view_cart', 'request_checkout'] as const;

// voice/domain/repositories.ts — เพิ่ม
//   findById(id: string): Promise<VoiceSession | null>;

// voice/application/ports.ts — เพิ่ม/แก้
export type CartSnapshot = Record<string, unknown>; // JSON ตาม schema Cart ที่ ordering map ให้ voice ไม่ตีความ
export interface VoiceCartOperations {
  add(cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }): Promise<CartSnapshot>;
  changeQuantity(cartId: string, lineId: string, quantity: number): Promise<CartSnapshot>;
  remove(cartId: string, lineId: string): Promise<CartSnapshot>;
  view(cartId: string): Promise<CartSnapshot>;
  readyForCheckout(cartId: string): Promise<CartSnapshot>; // CART_EMPTY ถ้าว่าง ไม่ยืนยัน
}
export interface VoiceMenu { current(): Promise<VoiceMenuItem[]> }
export interface VoiceSetup { systemInstruction: string }
export interface VoiceGateway { readonly available: boolean; issueConnection(now: Date, setup: VoiceSetup): Promise<VoiceConnection> } // แก้ signature

// voice/application/call-voice-function.ts
export class CallVoiceFunction {
  constructor(deps: { sessions: VoiceSessionRepository; carts: CartAvailability; cartOperations: VoiceCartOperations; gateway: VoiceGateway });
  execute(input: { sessionId: string; call: VoiceFunctionCall }): Promise<{ action: 'SHOW_CART' | 'SHOW_CHECKOUT'; cart: CartSnapshot }>;
}

// voice/infrastructure/voice-function-declarations.ts
export const VOICE_FUNCTION_DECLARATIONS: FunctionDeclaration[]; // จาก @google/genai ชื่อตรง VOICE_FUNCTION_NAMES

// ordering
// Cart.ensureReadyForCheckout(now: Date): void — assertModifiable + CART_EMPTY ไม่เปลี่ยน state
// application/check-cart-ready-for-checkout.ts: CheckCartReadyForCheckout.execute(cartId): Promise<CartView>
// createOrderingModule(...) คืนเพิ่ม voiceCart: VoiceCartOperations-compatible object (map ด้วย toCartJson)

// menu
// JsonMenuRepository.all(): Promise<MenuItem[]>

// voice/module.ts — createVoiceModule deps เพิ่ม { cartOperations: VoiceCartOperations; menu: VoiceMenu }
// app.ts — ส่ง ordering.voiceCart และ { current: () => menuRepository.all() }
```

Fakes (`src/modules/voice/application/__tests__/fakes.ts`) เพิ่ม:
- `FakeVoiceGateway.setups: VoiceSetup[]` จดทุกครั้งที่ `issueConnection` ถูกเรียก
- `FakeVoiceMenu implements VoiceMenu` มี `items: VoiceMenuItem[]`
- `FakeVoiceCartOperations implements VoiceCartOperations` จด `calls: { op: string; cartId: string; args: unknown[] }[]` คืน `{ id: cartId }` และมี `rejectWith?: string`
- `InMemoryVoiceSessions.findById`

---

### Task 1: AC1 โทเคนล็อกเมนูปัจจุบัน ฟังก์ชัน และภาษา

**Files:**
- Create: `src/modules/voice/domain/voice-menu.ts`, `voice-instructions.ts`, `voice-function-call.ts`, `src/modules/voice/infrastructure/voice-function-declarations.ts`
- Modify: `voice/application/ports.ts` (`VoiceMenu`, `VoiceSetup`, signature `issueConnection`), `start-voice-session.ts`, `ai-studio-voice-gateway.ts`, `unavailable-voice-gateway.ts`, `module.ts`, `fakes.ts`, `src/modules/menu/json-menu-repository.ts` (`all()`), `src/app.ts`, `tests/e2e/*.test.ts` ถ้าต้องส่ง deps เพิ่ม
- Test: `voice/domain/__tests__/voice-instructions.test.ts`, `ai-studio-voice-gateway.test.ts`, `start-voice-session.test.ts`, `src/modules/menu/__tests__/json-menu-repository.test.ts`

- [ ] **Step 1: เทสต์ที่ fail**
  - domain: `it('AC1: คำสั่งระบบมีทุกเมนู id ชื่อ ราคาบาท กลุ่มตัวเลือก ต้องเลือกหรือไม่ และตัวเลือกพร้อมราคาเพิ่ม')` ใช้เมนูจาก `src/modules/ordering/domain/__tests__/menu-fixtures.ts` แปลงเป็น `VoiceMenuItem` คาดข้อความมี `latte`, `ลาเต้`, `55 บาท`, `size-l`, `+10 บาท`, `ขนาด` คู่กับคำว่า `ต้องเลือก`, `นม` คู่กับ `ไม่บังคับ`
  - domain (Review Focus 4): `it('AC1: เมนูที่หมดระบุว่าหมด')` บรรทัดของ `matcha-latte` มีคำว่า `หมด`
  - gateway: `it('AC1: ล็อก systemInstruction, tools ทั้ง 5 และภาษา th-TH ในโทเคน')` คาด `config.liveConnectConstraints.config.systemInstruction` เท่ากับ setup ที่ส่งเข้า, `tools[0].functionDeclarations.map(d => d.name)` เท่ากับ `VOICE_FUNCTION_NAMES`, `speechConfig.languageCode === 'th-TH'` และ assertion เดิมของ AC12 ยังผ่าน
  - gateway: `it('AC1: schema ของ add_to_cart บังคับ menuItemId และ quantity')`
  - application: `it('AC1: StartVoiceSession ส่งคำสั่งระบบที่สร้างจากเมนูปัจจุบันให้ gateway')` คาด `gateway.setups[0].systemInstruction` มีชื่อเมนูจาก `FakeVoiceMenu`
  - menu: `it('AC1: all() อ่านไฟล์ใหม่ทุกครั้ง')`
- [ ] **Step 2: รัน** คาด FAIL: module not found / setups ว่าง
- [ ] **Step 3: เขียนโค้ด** ตาม Interfaces กลาง ก่อนเขียน `voice-function-declarations.ts` ให้ตรวจ type `FunctionDeclaration`, `Type`, `LiveConnectConfig.speechConfig` ใน `node_modules/@google/genai/dist/genai.d.ts` ถ้าชื่อ field ต่างจากแผน ให้ใช้ตาม type แล้วบันทึกในรายงาน ราคาแสดงเป็นบาทจำนวนเต็มเมื่อหาร 100 ลงตัว ไม่งั้นทศนิยม 2 ตำแหน่ง `StartVoiceSession` อ่านเมนูหลังบันทึกความยินยอม ก่อนขอโทเคน (ถ้าอ่านเมนูไม่ได้ ให้ error ตามปกติ ไม่ต้องจัดการพิเศษ)
- [ ] **Step 4: รัน** `npm test`, `npm run lint`, `npm run typecheck` ผ่าน
- [ ] **Step 5: Commit** `UC-03 AC1: lock the current menu, functions and th-TH into the voice token`

### Task 2: AC2 ข้อปฏิบัติของ Gemini และไม่มีข้อมูลบุคคล

**Files:** Modify: `voice-instructions.ts`; Test: `voice-instructions.test.ts`, `start-voice-session.test.ts`

- [ ] **Step 1: เทสต์ที่ fail** `it('AC2: คำสั่งระบบมีข้อปฏิบัติตาม R5')` คาดข้อความมีทุกข้อ: พูดภาษาไทยสั้นๆ, ถามตัวเลือกที่ต้องเลือกก่อนเรียก `add_to_cart`, ไม่เดาเมนูที่ไม่มี, พูดราคาตามผลของฟังก์ชันเท่านั้น, เรียก `request_checkout` เมื่อจะจ่ายเงินและบอกให้แตะยืนยันบนจอ, ห้ามยืนยันออเดอร์เอง (ตรวจด้วยคำสำคัญของแต่ละข้อ ระบุคำในเทสต์ให้ตรงกับข้อความที่เขียน) และ `it('AC2: คำสั่งระบบไม่มี cartId หรือ kioskId')` ใน application test คาด `systemInstruction` ไม่มี cartId และ `kiosk-1`
- [ ] **Step 2: รัน** คาด FAIL: ไม่มีข้อปฏิบัติ
- [ ] **Step 3: เขียนโค้ด** ข้อปฏิบัติเป็นข้อความคงที่ภาษาไทยใน `voice-instructions.ts`
- [ ] **Step 4: รัน** ผ่าน
- [ ] **Step 5: Commit** `UC-03 AC2: add Thai behaviour rules to the voice instructions`

### Task 3: AC3 `add_to_cart` (ตั้งโครง endpoint)

**Files:**
- Create: `voice/application/call-voice-function.ts`, `src/modules/ordering/application/voice-cart.ts` (หุ้ม `AddCartLine`, `ChangeCartLineQuantity`, `RemoveCartLine`, `GetCart` + `toCartJson`) หรือวางใน `ordering/module.ts` ถ้าสั้น
- Modify: `voice/domain/repositories.ts` + `pg-voice-session-repository.ts` (`findById`), `ports.ts` (`VoiceCartOperations`, `CartSnapshot`), `module.ts`, `routes.ts`, `mapper.ts`, `fakes.ts`, `ordering/module.ts`, `ordering/index.ts` ถ้าต้อง export type, `src/app.ts`
- Test: `call-voice-function.test.ts`, `pg-voice-session-repository.test.ts`, voice `routes.test.ts`, `src/modules/ordering/application/__tests__/voice-cart.test.ts`

ในขั้นนี้ route ตรวจ body แค่พอให้ `add_to_cart` ทำงาน (AC16 เพิ่มการตรวจครบ) use case ยังไม่เรียก `assertVoiceAvailable` (AC17) และยังไม่เรียก `carts.assertOpen` (AC15)

- [ ] **Step 1: เทสต์ที่ fail**
  - repository (DB จริง): `it('AC3: findById คืนเซสชันที่บันทึกไว้ และ null ถ้าไม่มี')`
  - application: `it('AC3: add_to_cart เรียก cartOperations.add ด้วย cartId ของเซสชัน')` คาด `calls[0]` เท่ากับ `{ op: 'add', cartId: <ของเซสชัน>, args: [{ menuItemId: 'latte', optionChoiceIds: ['size-l','milk-oat'], quantity: 2 }] }` และผล `action === 'SHOW_CART'`
  - ordering: `it('AC3: voiceCart.add เพิ่มรายการด้วยกฎ UC-01 และคืน JSON ตาม Cart')` ใช้ `InMemoryOrdering` + `FakeMenu` คาด `total.amount === '160.00'`
  - route: `it('AC3: POST /voice/sessions/{id}/function-calls add_to_cart ตอบ 200 ตาม spec')` ประกอบ ordering (`InMemoryOrdering`) + voice ใน express เดียว ยินยอมก่อนด้วย `POST /voice/sessions` แล้วเรียก add คาด `body.cart.lines[0].quantity === 2`, `body.cart.total.amount === '160.00'`, `expectMatchesSpec('post', '/voice/sessions/{sessionId}/function-calls', res)`
- [ ] **Step 2: รัน** คาด FAIL: module not found / 404 จาก express
- [ ] **Step 3: เขียนโค้ด** `CallVoiceFunction.execute`: `findById` (ไม่พบ → `VOICE_SESSION_NOT_FOUND` เพิ่มใน `http-errors.ts` ด้วย) → `switch (call.name)` เรียก port ตามชื่อ การ map ชื่อฟังก์ชัน → operation เป็นการส่งต่อ ไม่ใช่กฎธุรกิจ
- [ ] **Step 4: รัน** `npm test` ผ่าน
- [ ] **Step 5: Commit** `UC-03 AC3: add items to the session's cart from a voice function call`

### Task 4: AC4 `change_quantity`
**Files:** Modify: route body, `call-voice-function.ts`; Test: `call-voice-function.test.ts`, `routes.test.ts`
- [ ] เทสต์ `it('AC4: change_quantity เปลี่ยนรายการเป็น 4 แก้ว')` (application: เรียก `changeQuantity(cartId, lineId, 4)`; route: เพิ่มลาเต้ 2 แล้วเปลี่ยนเป็น 4 คาด `lines[0].quantity === 4` ตาม spec) → red → code → green → commit `UC-03 AC4: change a line's quantity by voice`

### Task 5: AC5 `remove_from_cart`
- [ ] เทสต์ `it('AC5: remove_from_cart ลบรายการ ตะกร้าว่าง')` (application + route) → red → code → green → commit `UC-03 AC5: remove a line by voice`

### Task 6: AC6 `view_cart`
- [ ] เทสต์ `it('AC6: view_cart คืนตะกร้าล่าสุด ไม่เปลี่ยนอะไร')` route คาด `expiresAt` เท่ากับก่อนเรียก (ไม่ต่ออายุ) และ `lines` เท่าเดิม → red → code → green → commit `UC-03 AC6: read the cart by voice`

### Task 7: AC7 `request_checkout`
**Files:** Create: `src/modules/ordering/application/check-cart-ready-for-checkout.ts`; Modify: `cart.ts` (`ensureReadyForCheckout`), voice-cart, `call-voice-function.ts`; Test: ordering `cart.test.ts`, `check-cart-ready-for-checkout.test.ts`, voice `call-voice-function.test.ts`, `routes.test.ts`
- [ ] **Step 1: เทสต์ที่ fail**
  - ordering domain: `it('AC7 (UC-03): ensureReadyForCheckout ไม่เปลี่ยนสถานะและไม่ต่ออายุ')`
  - voice application: `action === 'SHOW_CHECKOUT'`
  - route: `it('AC7: request_checkout ตอบ SHOW_CHECKOUT ตะกร้ายัง OPEN ไม่มีออเดอร์')` คาด `body.cart.status === 'OPEN'` และ `uow.orders.size === 0`
- [ ] **Step 2–4** red → code → green
- [ ] **Step 5: Commit** `UC-03 AC7: show the checkout screen on request without confirming`

### Task 8: AC8 `request_checkout` กับตะกร้าว่าง
- [ ] เทสต์ ordering domain `it('AC8 (UC-03): ensureReadyForCheckout ตะกร้าว่าง → CART_EMPTY')` และ route 409 `CART_EMPTY` ตาม spec → red → code → green → commit `UC-03 AC8: reject checkout request for an empty cart`

### Task 9: AC9–AC12 ผิดกฎ UC-01 ระหว่างสั่งด้วยเสียง
**Files:** Test: voice `routes.test.ts` (ประกอบกับ ordering จริงบน `InMemoryOrdering`)
- [ ] เทสต์ทีละ AC แยก commit:
  - `it('AC9: add_to_cart อเมริกาโน่ไม่เลือกขนาด → 409 OPTION_REQUIRED groupId size')` คาด `body.details.groupId === 'size'`
  - `it('AC10: add_to_cart bubble-tea → 404 MENU_ITEM_NOT_FOUND')`
  - `it('AC11: add_to_cart มัทฉะลาเต้ที่หมด → 409 MENU_ITEM_UNAVAILABLE')`
  - `it('AC12: ตะกร้า 18 แก้วเพิ่มอีก 3 → 409 CART_LIMIT_REACHED; 11 แก้ว → 409 QUANTITY_OUT_OF_RANGE')`
- [ ] ทุกตัวตรวจ `expectMatchesSpec` คาดว่า **ผ่านทันที** เพราะ ordering บังคับกฎแล้ว ให้ยืนยันว่าเทสต์จับได้ด้วยการพังชั่วคราวใน voice (เช่นให้ `CallVoiceFunction` กลืน error แล้วคืน `SHOW_CART`) เก็บ log แล้วคืนค่าเดิม
- [ ] Commit ละ AC: `UC-03 AC9: ...` ถึง `UC-03 AC12: ...`

### Task 10: AC13 แตะตะกร้าอื่นไม่ได้
**Files:** Test: voice `routes.test.ts`, `call-voice-function.test.ts`
- [ ] เทสต์ route `it('AC13: เซสชันของตะกร้า A ใช้ lineId ของตะกร้า B → 404 CART_LINE_NOT_FOUND ตะกร้า B ไม่เปลี่ยน')` ทั้ง `change_quantity` และ `remove_from_cart` แล้ว `GET /carts/{B}` ยังเหมือนเดิม
- [ ] เทสต์ application (Review Focus 5): `it('AC13: args มี cartId ปลอม ยังใช้ตะกร้าของเซสชัน')` ส่ง `{ name: 'view_cart', cartId: <B> }` ผ่าน route (args เกินถูกตัดทิ้ง) คาด `cart.id === A`
- [ ] คาดว่าผ่านทันที (cartId มาจากเซสชัน) พิสูจน์ด้วยการพังชั่วคราว (ใช้ cartId จาก args ถ้ามี) เก็บ log แล้วคืนค่าเดิม
- [ ] Commit `UC-03 AC13: keep voice calls inside the session's own cart`

### Task 11: AC14 ไม่พบเซสชันเสียง
- [ ] เทสต์ route `it('AC14: sessionId ที่ไม่มี → 404 VOICE_SESSION_NOT_FOUND')` และ (Review Focus 3) `it('AC14: sessionId ไม่ใช่ uuid → 404 VOICE_SESSION_NOT_FOUND')` ตรวจ uuid ใน route แบบเดียวกับ `startSessionBody` → red → code → green → commit `UC-03 AC14: answer VOICE_SESSION_NOT_FOUND for unknown sessions`

### Task 12: AC15 ตะกร้าของเซสชันหมดอายุหรือยืนยันแล้ว
**Files:** Modify: `call-voice-function.ts`; Test: `call-voice-function.test.ts`, `routes.test.ts`
- [ ] **Step 1: เทสต์ที่ fail** application `it.each(VOICE_FUNCTION_NAMES)('AC15: %s กับตะกร้าที่ CartAvailability ปฏิเสธ CART_EXPIRED → ไม่เรียก cartOperations')` และ route (Review Focus 1) `it('AC15: view_cart หลังตะกร้าไม่ได้แก้ไขครบ 15 นาที → 409 CART_EXPIRED')` ใช้ `clock.advance(15 * 60_000)` และ `it('AC15: หลังยืนยันออเดอร์ → 409 CART_ALREADY_CHECKED_OUT')`
- [ ] **Step 2: รัน** คาด FAIL: `view_cart` ตอบ 200
- [ ] **Step 3: เขียนโค้ด** `CallVoiceFunction` เรียก `carts.assertOpen(session.cartId)` ก่อนทุกฟังก์ชัน (deps เพิ่ม `carts: CartAvailability` ที่มีอยู่แล้ว)
- [ ] **Step 4–5** green → commit `UC-03 AC15: reject voice calls on expired or checked-out carts`

### Task 13: AC16 ชื่อฟังก์ชันหรือ args ผิดรูปแบบ
**Files:** Modify: `routes.ts`; Test: `routes.test.ts`
- [ ] **Step 1: เทสต์ที่ fail** `it.each([...])('AC16: body %j → 400 VALIDATION_ERROR fields %j')` อย่างน้อย:
  - `{}` → `['name']`
  - `{ name: 'fly' }` → `['name']`
  - `{ name: 'add_to_cart', args: {} }` → `['menuItemId', 'quantity']`
  - `{ name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 1.5 } }` → `['quantity']`
  - `{ name: 'add_to_cart', args: { menuItemId: 'latte', optionChoiceIds: 'size-l', quantity: 1 } }` → `['optionChoiceIds']`
  - `{ name: 'change_quantity', args: { lineId: 'x', quantity: 2 } }` → `['lineId']` (ไม่ใช่ uuid)
  - (Review Focus 2) `{ name: 'view_cart', args: null }`, `args: []`, `args: 'x'` → `['args']`
  - ไม่ส่ง body เลย → `['name']`
  ทุกตัวตรวจ `expectMatchesSpec` และ `cartOperations` ไม่ถูกเรียก (ใช้ fake)
- [ ] **Step 2: รัน** คาด FAIL: 500 หรือ 200
- [ ] **Step 3: เขียนโค้ด** `functionCallBody(body: unknown): VoiceFunctionCall` ใน routes.ts โยน `RequestValidationError` args ที่ไม่ส่งถือเป็น `{}` ช่วงของจำนวนไม่ตรวจที่นี่ (UC-01 ตอบ 409)
- [ ] **Step 4–5** green → commit `UC-03 AC16: reject unknown functions and malformed arguments`

### Task 14: AC17 ปิดใช้เสียง
- [ ] เทสต์ application `it('AC17: ปิดเสียง → VOICE_UNAVAILABLE ไม่เรียก cartOperations')` และ route 503 ตาม spec → red → code (`assertVoiceAvailable(gateway.available)` บรรทัดแรกของ `execute`) → green → commit `UC-03 AC17: answer VOICE_UNAVAILABLE for voice calls when voice is off`

### Task 15: AC18 การสั่งด้วยเสียงต่ออายุตะกร้า
- [ ] เทสต์ route `it('AC18: ตะกร้าแก้ไขล่าสุด 10 นาทีก่อน add_to_cart แล้ว expiresAt = ตอนนี้ + 15 นาที')` ใช้ `fixedClock` สร้างตะกร้าตอน 02:30Z `advance(10 นาที)` เรียก add คาด `expiresAt === '2026-10-20T02:55:00.000Z'` คาดว่าผ่านทันที (ordering ต่ออายุอยู่แล้ว) พิสูจน์ด้วยการพังชั่วคราว (ลบบรรทัด `this.lastActivityAt = now` ใน `Cart.addLine`) เก็บ log แล้วคืนค่าเดิม → commit `UC-03 AC18: voice additions renew the cart like taps`

### Task 16: E2E และเอกสาร
**Files:** Create: `tests/e2e/voice-ordering.test.ts`; Modify: `docs/architecture/context-map.md` ถ้าชื่อจริงต่างจากที่เขียนไว้
- [ ] เทสต์ `it('AC3, AC4, AC7: เริ่มตะกร้า → ยินยอม → add_to_cart → change_quantity → view_cart → request_checkout → แตะยืนยัน → เรียกฟังก์ชันอีก 409')` บน Postgres จริงและ `data/menu.json` จริง `FakeVoiceGateway` ทุก response ผ่าน `expectMatchesSpec` และตรวจว่า `gateway.setups[0].systemInstruction` มี `ลาเต้`
- [ ] `npm test`, `npm run lint`, `npm run typecheck` ผ่าน และ migrate จากศูนย์ + seed บน postgres:16-alpine ผ่าน
- [ ] Commit `UC-03 AC3, AC4, AC7: end-to-end voice ordering across ordering and voice`
