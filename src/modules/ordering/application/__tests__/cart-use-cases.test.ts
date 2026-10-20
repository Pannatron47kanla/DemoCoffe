import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { DomainError } from '../../../../shared/domain-error';
import { sequentialIds } from '../../../../shared/ids';
import { americano, latte } from '../../domain/__tests__/menu-fixtures';
import { AddCartLine } from '../add-cart-line';
import { ChangeCartLineQuantity } from '../change-cart-line-quantity';
import { CheckCartReadyForCheckout } from '../check-cart-ready-for-checkout';
import { GetCart } from '../get-cart';
import { RemoveCartLine } from '../remove-cart-line';
import { StartCart } from '../start-cart';
import { FakeMenu, InMemoryOrdering } from './fakes';

async function expectDomainError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

describe('cart use cases', () => {
  let uow: InMemoryOrdering;
  let menu: FakeMenu;
  let clock: ReturnType<typeof fixedClock>;
  let deps: { uow: InMemoryOrdering; menu: FakeMenu; clock: ReturnType<typeof fixedClock>; ids: () => string };

  beforeEach(() => {
    uow = new InMemoryOrdering();
    menu = new FakeMenu([latte, americano]);
    clock = fixedClock('2026-10-19T02:30:00Z');
    deps = { uow, menu, clock, ids: sequentialIds() };
  });

  const start = () => new StartCart(deps).execute();
  const addLatte = (cartId: string, quantity = 2) =>
    new AddCartLine(deps).execute({ cartId, menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity });

  it('AC1: StartCart สร้างและบันทึกตะกร้าว่าง', async () => {
    const view = await start();

    expect(view.cart.lines).toEqual([]);
    expect(view.cart.expiresAt).toEqual(new Date('2026-10-19T02:45:00Z'));
    expect(uow.carts.has(view.cart.id)).toBe(true);
  });

  it('AC2: AddCartLine คิดราคาจากเมนู บันทึก และคืนข้อมูลเมนูสำหรับแสดงชื่อ', async () => {
    const { cart } = await start();

    const view = await addLatte(cart.id);

    expect(view.cart.total.satang).toBe(16000);
    expect(view.items.map((i) => i.id)).toEqual(['latte']);
    expect(uow.cart(cart.id).total.satang).toBe(16000);
  });

  it('AC4: ChangeCartLineQuantity บันทึกจำนวนใหม่', async () => {
    const { cart } = await start();
    const lineId = (await addLatte(cart.id)).cart.lines[0]!.id;

    await new ChangeCartLineQuantity(deps).execute({ cartId: cart.id, lineId, quantity: 4 });

    expect(uow.cart(cart.id).lines[0]!.quantity).toBe(4);
  });

  it('AC5: RemoveCartLine บันทึกตะกร้าว่าง', async () => {
    const { cart } = await start();
    const lineId = (await addLatte(cart.id)).cart.lines[0]!.id;

    const view = await new RemoveCartLine(deps).execute({ cartId: cart.id, lineId });

    expect(view.cart.lines).toEqual([]);
    expect(uow.cart(cart.id).lines).toEqual([]);
  });

  it('AC7: เพิ่มเมนูที่ไม่มีอยู่ MENU_ITEM_NOT_FOUND', async () => {
    const { cart } = await start();

    await expectDomainError(
      new AddCartLine(deps).execute({ cartId: cart.id, menuItemId: 'unicorn-frappe', optionChoiceIds: [], quantity: 1 }),
      'MENU_ITEM_NOT_FOUND',
    );
  });

  it('AC13: ทุก use case ตอบ CART_NOT_FOUND เมื่อไม่มีตะกร้า', async () => {
    const missing = 'c0000000-0000-4000-8000-00000000dead';

    await expectDomainError(new GetCart(deps).execute(missing), 'CART_NOT_FOUND');
    await expectDomainError(addLatte(missing), 'CART_NOT_FOUND');
    await expectDomainError(new ChangeCartLineQuantity(deps).execute({ cartId: missing, lineId: 'x', quantity: 1 }), 'CART_NOT_FOUND');
    await expectDomainError(new RemoveCartLine(deps).execute({ cartId: missing, lineId: 'x' }), 'CART_NOT_FOUND');
  });

  it('AC14: ใช้เวลาจาก clock ที่ inject ตะกร้าเกิน 15 นาที CART_EXPIRED', async () => {
    const { cart } = await start();
    clock.advance(15 * 60_000);

    await expectDomainError(addLatte(cart.id), 'CART_EXPIRED');
  });

  it('AC2: GetCart คืนตะกร้าพร้อมเมนูของรายการ', async () => {
    const { cart } = await start();
    await addLatte(cart.id);

    const view = await new GetCart(deps).execute(cart.id);

    expect(view.cart.totalCups).toBe(2);
    expect(view.items.map((i) => i.id)).toEqual(['latte']);
  });

  it('AC7 (UC-03): CheckCartReadyForCheckout คืนตะกร้าโดยไม่บันทึกและไม่ต่ออายุ', async () => {
    const { cart } = await start();
    await addLatte(cart.id);
    const before = (await new GetCart(deps).execute(cart.id)).cart.expiresAt;
    clock.advance(5 * 60_000);

    const view = await new CheckCartReadyForCheckout(deps).execute(cart.id);

    expect(view.cart.status).toBe('OPEN');
    expect(view.items.map((i) => i.id)).toEqual(['latte']);
    expect((await new GetCart(deps).execute(cart.id)).cart.expiresAt).toEqual(before);
    expect(uow.orders.size).toBe(0);
  });
});
