import { DomainError } from '../../../shared/domain-error';
import { Money } from './money';
import type { OrderableItem } from './orderable-item';

export interface CartLineState {
  id: string;
  menuItemId: string;
  optionChoiceIds: readonly string[];
  quantity: number;
  unitPriceSatang: number;
}

// เปลี่ยนได้ผ่าน Cart เท่านั้น
export class CartLine {
  static readonly MAX_QUANTITY = 10;

  private constructor(
    readonly id: string,
    readonly menuItemId: string,
    readonly optionChoiceIds: readonly string[],
    private _quantity: number,
    private _unitPrice: Money,
  ) {}

  static start(id: string, item: OrderableItem, optionChoiceIds: readonly string[], quantity: number): CartLine {
    if (!item.available) throw new DomainError('MENU_ITEM_UNAVAILABLE', { menuItemId: item.id });
    assertValidOptions(item, optionChoiceIds);
    assertQuantity(quantity);
    return new CartLine(id, item.id, [...optionChoiceIds].sort(), quantity, unitPriceOf(item, optionChoiceIds));
  }

  static restore(state: CartLineState): CartLine {
    return new CartLine(state.id, state.menuItemId, state.optionChoiceIds, state.quantity, Money.satang(state.unitPriceSatang));
  }

  get quantity() { return this._quantity; }
  get unitPrice() { return this._unitPrice; }
  get lineTotal() { return this._unitPrice.times(this._quantity); }

  matches(menuItemId: string, optionChoiceIds: readonly string[]): boolean {
    const sorted = [...optionChoiceIds].sort();
    return this.menuItemId === menuItemId
      && this.optionChoiceIds.length === sorted.length
      && this.optionChoiceIds.every((id, i) => id === sorted[i]);
  }

  /** @internal เรียกจาก Cart ซึ่งตรวจขีดจำกัดของทั้งตะกร้าแล้ว */
  changeQuantity(quantity: number) {
    assertQuantity(quantity);
    this._quantity = quantity;
  }

  /** @internal เรียกจาก Cart.reviewPrices() */
  reprice(unitPrice: Money) {
    this._unitPrice = unitPrice;
  }

  toState(): CartLineState {
    return {
      id: this.id,
      menuItemId: this.menuItemId,
      optionChoiceIds: this.optionChoiceIds,
      quantity: this._quantity,
      unitPriceSatang: this._unitPrice.satang,
    };
  }
}

// R4
function assertQuantity(quantity: number) {
  if (quantity < 1 || quantity > CartLine.MAX_QUANTITY) {
    throw new DomainError('QUANTITY_OUT_OF_RANGE', { min: 1, max: CartLine.MAX_QUANTITY });
  }
}

// R2 กลุ่มบังคับเลือก 1 ค่าพอดี กลุ่มไม่บังคับ 0–1 ค่า ตัวเลือกต้องอยู่ในเมนูนั้น
function assertValidOptions(item: OrderableItem, optionChoiceIds: readonly string[]) {
  if (new Set(optionChoiceIds).size !== optionChoiceIds.length) throw new DomainError('INVALID_OPTION');

  const chosenPerGroup = new Map<string, number>();
  for (const choiceId of optionChoiceIds) {
    const group = item.optionGroups.find((g) => g.choices.some((c) => c.id === choiceId));
    if (!group) throw new DomainError('INVALID_OPTION', { choiceId });
    chosenPerGroup.set(group.id, (chosenPerGroup.get(group.id) ?? 0) + 1);
  }

  for (const group of item.optionGroups) {
    const chosen = chosenPerGroup.get(group.id) ?? 0;
    if (chosen > 1) throw new DomainError('INVALID_OPTION', { groupId: group.id });
    if (group.required && chosen === 0) throw new DomainError('OPTION_REQUIRED', { groupId: group.id });
  }
}

// R3 ราคาต่อแก้ว = ราคาตั้งต้น + ราคาเพิ่มของตัวเลือก
export function unitPriceOf(item: OrderableItem, optionChoiceIds: readonly string[]): Money {
  const choices = item.optionGroups.flatMap((group) => group.choices);
  return optionChoiceIds.reduce(
    (price, choiceId) => price.plus(Money.satang(choices.find((c) => c.id === choiceId)?.priceDeltaSatang ?? 0)),
    Money.satang(item.basePriceSatang),
  );
}
