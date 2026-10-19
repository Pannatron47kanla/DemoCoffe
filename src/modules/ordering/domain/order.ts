import { DomainError } from '../../../shared/domain-error';
import { BusinessDay } from './business-day';
import { Money } from './money';
import { QueueNumber } from './queue-number';

export type OrderStatus = 'PLACED';

// R12 snapshot ณ ตอนยืนยัน ไม่อ้างอิงเมนูปัจจุบัน
export interface OrderLineOption {
  readonly choiceId: string;
  readonly groupName: string;
  readonly name: string;
  readonly priceDeltaSatang: number;
}

export interface OrderLine {
  readonly menuItemId: string;
  readonly name: string;
  readonly options: readonly OrderLineOption[];
  readonly quantity: number;
  readonly unitPriceSatang: number;
}

export interface OrderState {
  id: string;
  cartId: string;
  idempotencyKey: string;
  status: OrderStatus;
  businessDay: string;
  queueNumber: number;
  placedAt: Date;
  lines: OrderLine[];
}

export class Order {
  private constructor(
    readonly id: string,
    readonly cartId: string,
    readonly idempotencyKey: string,
    readonly status: OrderStatus,
    readonly businessDay: BusinessDay,
    readonly queueNumber: QueueNumber,
    readonly placedAt: Date,
    readonly lines: readonly OrderLine[],
  ) {}

  /** @internal สร้างผ่าน Cart.checkout() เท่านั้น */
  static place(input: Omit<OrderState, 'status' | 'businessDay' | 'queueNumber'> & { queueNumber: QueueNumber }): Order {
    return new Order(
      input.id, input.cartId, input.idempotencyKey, 'PLACED',
      BusinessDay.of(input.placedAt), input.queueNumber, input.placedAt, input.lines,
    );
  }

  static restore(state: OrderState): Order {
    return new Order(
      state.id, state.cartId, state.idempotencyKey, state.status,
      BusinessDay.restore(state.businessDay), QueueNumber.of(state.queueNumber), state.placedAt, state.lines,
    );
  }

  get total(): Money {
    return this.lines.reduce((sum, l) => sum.plus(Money.satang(l.unitPriceSatang).times(l.quantity)), Money.ZERO);
  }

  // R11 ยืนยันซ้ำด้วย key เดิม: ตะกร้าเดิมได้ออเดอร์เดิม ตะกร้าอื่นใช้ key นี้ไม่ได้
  replayFor(cartId: string): Order {
    if (cartId !== this.cartId) throw new DomainError('IDEMPOTENCY_KEY_CONFLICT');
    return this;
  }

  toState(): OrderState {
    return {
      id: this.id,
      cartId: this.cartId,
      idempotencyKey: this.idempotencyKey,
      status: this.status,
      businessDay: this.businessDay.value,
      queueNumber: this.queueNumber.value,
      placedAt: this.placedAt,
      lines: [...this.lines],
    };
  }
}
