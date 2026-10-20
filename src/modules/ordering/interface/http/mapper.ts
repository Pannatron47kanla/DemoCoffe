import type { CartView } from '../../application/cart-view';
import type { Order } from '../../domain/order';
import { money } from '../../../../shared/money-json';

// domain → JSON ตาม openapi.yaml (เงินเป็นบาท ทศนิยม 2 ตำแหน่ง)
export function toCartJson({ cart, items }: CartView) {
  return {
    id: cart.id,
    status: cart.status,
    expiresAt: cart.expiresAt.toISOString(),
    lines: cart.lines.map((line) => {
      const item = items.find((i) => i.id === line.menuItemId);
      const options = (item?.optionGroups ?? []).flatMap((group) =>
        group.choices
          .filter((choice) => line.optionChoiceIds.includes(choice.id))
          .map((choice) => ({ choiceId: choice.id, groupName: group.name, name: choice.name, priceDelta: money(choice.priceDeltaSatang) })),
      );
      return {
        id: line.id,
        menuItemId: line.menuItemId,
        name: item?.name ?? line.menuItemId, // เมนูถูกลบออกจากไฟล์แล้ว แสดง id แทน
        options,
        quantity: line.quantity,
        unitPrice: money(line.unitPrice.satang),
        lineTotal: money(line.lineTotal.satang),
      };
    }),
    totalCups: cart.totalCups,
    total: money(cart.total.satang),
  };
}

export function toOrderJson(order: Order) {
  return {
    id: order.id,
    cartId: order.cartId,
    status: order.status,
    queueNumber: order.queueNumber.value,
    placedAt: order.placedAt.toISOString(),
    lines: order.lines.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.name,
      options: line.options.map((o) => ({ choiceId: o.choiceId, groupName: o.groupName, name: o.name, priceDelta: money(o.priceDeltaSatang) })),
      quantity: line.quantity,
      unitPrice: money(line.unitPriceSatang),
      lineTotal: money(line.unitPriceSatang * line.quantity),
    })),
    total: money(order.total.satang),
  };
}
