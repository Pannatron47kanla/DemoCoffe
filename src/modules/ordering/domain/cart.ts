import { DomainError } from '../../../shared/domain-error';
import { CartLine, unitPriceOf, type CartLineState } from './cart-line';
import { Money } from './money';
import { Order, type OrderLine } from './order';
import type { OrderableItem } from './orderable-item';
import type { QueueNumber } from './queue-number';

export type CartStatus = 'OPEN' | 'CHECKED_OUT';

export interface AddLine {
  lineId: string;
  item: OrderableItem;
  optionChoiceIds: readonly string[];
  quantity: number;
}

export interface Checkout {
  orderId: string;
  idempotencyKey: string;
  menu: readonly OrderableItem[];
  queueNumber: QueueNumber;
  now: Date;
}

export interface CartState {
  id: string;
  status: CartStatus;
  lastActivityAt: Date;
  lines: CartLineState[];
}

export class Cart {
  static readonly IDLE_TIMEOUT_MINUTES = 15;
  static readonly MAX_CUPS = 20;

  private pricesChangedOnReview = false;

  private constructor(
    readonly id: string,
    private _status: CartStatus,
    private lastActivityAt: Date,
    private _lines: CartLine[],
  ) {}

  static start(id: string, now: Date): Cart {
    return new Cart(id, 'OPEN', now, []);
  }

  static restore(state: CartState): Cart {
    return new Cart(state.id, state.status, state.lastActivityAt, state.lines.map(CartLine.restore));
  }

  get status() { return this._status; }
  get lines(): readonly CartLine[] { return this._lines; }
  get totalCups() { return this._lines.reduce((sum, line) => sum + line.quantity, 0); }
  get total() { return this._lines.reduce((sum, line) => sum.plus(line.lineTotal), Money.ZERO); }
  get expiresAt() { return new Date(this.lastActivityAt.getTime() + Cart.IDLE_TIMEOUT_MINUTES * 60_000); }

  // R7, R8 ให้ context อื่นถามว่ายังแก้ไขได้ไหม
  ensureOpen(now: Date): void {
    this.assertModifiable(now);
  }

  addLine({ lineId, item, optionChoiceIds, quantity }: AddLine, now: Date): void {
    this.assertModifiable(now);
    const line = CartLine.start(lineId, item, optionChoiceIds, quantity);
    const existing = this._lines.find((l) => l.matches(item.id, optionChoiceIds));
    // R6 ชุดเดียวกันรวมเข้ารายการเดิม
    const merged = existing ? existing.quantity + quantity : quantity;
    this.assertWithinCupLimit(this.totalCups - (existing?.quantity ?? 0) + merged);
    if (existing) existing.changeQuantity(merged);
    else this._lines.push(line);
    this.lastActivityAt = now;
  }

  changeQuantity(lineId: string, quantity: number, now: Date): void {
    this.assertModifiable(now);
    const line = this.lineById(lineId);
    this.assertWithinCupLimit(this.totalCups - line.quantity + quantity);
    line.changeQuantity(quantity);
    this.lastActivityAt = now;
  }

  removeLine(lineId: string, now: Date): void {
    this.assertModifiable(now);
    const line = this.lineById(lineId);
    this._lines = this._lines.filter((l) => l !== line);
    this.lastActivityAt = now;
  }

  // R9 ปรับราคาในตะกร้าให้ตรงเมนูปัจจุบัน ถ้ามีการเปลี่ยน checkout() ครั้งนี้จะปฏิเสธเพื่อให้ลูกค้าดูยอดใหม่
  // ไม่นับเป็นการแก้ไขของลูกค้า จึงไม่ต่ออายุตะกร้า
  reviewPrices(menu: readonly OrderableItem[], now: Date): void {
    this.assertModifiable(now);
    for (const line of this._lines) {
      const item = menu.find((i) => i.id === line.menuItemId);
      if (!item?.available) continue;
      const current = unitPriceOf(item, line.optionChoiceIds);
      if (!current.equals(line.unitPrice)) {
        line.reprice(current);
        this.pricesChangedOnReview = true;
      }
    }
  }

  checkout({ orderId, idempotencyKey, menu, queueNumber, now }: Checkout): Order {
    this.assertModifiable(now);
    if (this._lines.length === 0) throw new DomainError('CART_EMPTY');

    const items = new Map(menu.map((item) => [item.id, item]));
    // R1 ตรวจสถานะเมนูอีกครั้งตอนยืนยัน
    const unavailable = this._lines.filter((l) => !items.get(l.menuItemId)?.available).map((l) => l.id);
    if (unavailable.length > 0) throw new DomainError('MENU_ITEM_UNAVAILABLE', { lineIds: unavailable });

    const priceChanged = this._lines.some((l) => !unitPriceOf(items.get(l.menuItemId)!, l.optionChoiceIds).equals(l.unitPrice));
    if (this.pricesChangedOnReview || priceChanged) throw new DomainError('PRICE_CHANGED');

    this._status = 'CHECKED_OUT';
    return Order.place({
      id: orderId,
      cartId: this.id,
      idempotencyKey,
      queueNumber,
      placedAt: now,
      lines: this._lines.map((l) => snapshotOf(l, items.get(l.menuItemId)!)),
    });
  }

  toState(): CartState {
    return { id: this.id, status: this._status, lastActivityAt: this.lastActivityAt, lines: this._lines.map((l) => l.toState()) };
  }

  private lineById(lineId: string): CartLine {
    const line = this._lines.find((l) => l.id === lineId);
    if (!line) throw new DomainError('CART_LINE_NOT_FOUND', { lineId });
    return line;
  }

  // R7, R8
  private assertModifiable(now: Date) {
    if (this._status === 'CHECKED_OUT') throw new DomainError('CART_ALREADY_CHECKED_OUT');
    if (now.getTime() >= this.expiresAt.getTime()) throw new DomainError('CART_EXPIRED');
  }

  // R5 (จำนวนต่อรายการ R4 ตรวจใน CartLine ก่อน)
  private assertWithinCupLimit(totalCups: number) {
    if (totalCups > Cart.MAX_CUPS) throw new DomainError('CART_LIMIT_REACHED', { max: Cart.MAX_CUPS });
  }
}

// R12 สำเนาชื่อ ตัวเลือก และราคา ณ ตอนยืนยัน เรียงตัวเลือกตามลำดับกลุ่มในเมนู
function snapshotOf(line: CartLine, item: OrderableItem): OrderLine {
  return {
    menuItemId: item.id,
    name: item.name,
    options: item.optionGroups.flatMap((group) =>
      group.choices
        .filter((choice) => line.optionChoiceIds.includes(choice.id))
        .map((choice) => ({ choiceId: choice.id, groupName: group.name, name: choice.name, priceDeltaSatang: choice.priceDeltaSatang })),
    ),
    quantity: line.quantity,
    unitPriceSatang: line.unitPrice.satang,
  };
}
