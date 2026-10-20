import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { DomainError } from '../../../../shared/domain-error';
import { CheckCartAvailability } from '../check-cart-availability';
import { InMemoryOrdering } from './fakes';

async function expectDomainError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

describe('CheckCartAvailability', () => {
  let uow: InMemoryOrdering;
  let clock: ReturnType<typeof fixedClock>;
  let check: CheckCartAvailability;

  beforeEach(() => {
    uow = new InMemoryOrdering();
    clock = fixedClock('2026-10-20T02:30:00Z'); // 09:30 Asia/Bangkok
    check = new CheckCartAvailability({ uow, clock });
  });

  function storeCart(id: string) {
    uow.carts.set(id, { id, status: 'OPEN', lastActivityAt: clock.now(), lines: [] });
  }

  it('AC6: ไม่มีตะกร้านี้ → CART_NOT_FOUND', async () => {
    await expectDomainError(check.assertOpen('00000000-0000-4000-8000-0000000000c9'), 'CART_NOT_FOUND');
  });

  it('AC7: ตะกร้าไม่ได้แก้ไขครบ 15 นาที → CART_EXPIRED', async () => {
    storeCart('cart-a');
    clock.advance(15 * 60_000);

    await expectDomainError(check.assertOpen('cart-a'), 'CART_EXPIRED');
  });
});
