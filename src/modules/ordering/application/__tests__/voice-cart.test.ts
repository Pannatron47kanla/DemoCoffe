import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../../../shared/clock';
import { sequentialIds } from '../../../../shared/ids';
import { createOrderingModule } from '../../module';
import { americano, latte } from '../../domain/__tests__/menu-fixtures';
import { FakeMenu, InMemoryOrdering } from './fakes';

describe('voiceCart', () => {
  it('AC3: voiceCart.add เพิ่มรายการด้วยกฎ UC-01 และคืน JSON ตาม Cart', async () => {
    const ordering = createOrderingModule({
      uow: new InMemoryOrdering(), menu: new FakeMenu([latte, americano]), clock: fixedClock('2026-10-20T02:30:00Z'), ids: sequentialIds(),
    });
    const { cart } = await ordering.useCases.startCart.execute();

    const json = await ordering.voiceCart.add(cart.id, { menuItemId: 'latte', optionChoiceIds: ['size-l', 'milk-oat'], quantity: 2 });

    expect(json).toMatchObject({ id: cart.id, totalCups: 2, total: { amount: '160.00', currency: 'THB' } });
    expect((json.lines as { quantity: number }[])[0]!.quantity).toBe(2);
  });
});
