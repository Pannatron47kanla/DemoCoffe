// เงินหน่วยสตางค์ (จำนวนเต็ม) เพื่อเลี่ยงทศนิยมของ float
export class Money {
  static readonly ZERO = new Money(0);

  private constructor(readonly satang: number) {}

  static satang(value: number): Money {
    return new Money(value);
  }

  plus(other: Money): Money {
    return new Money(this.satang + other.satang);
  }

  times(quantity: number): Money {
    return new Money(this.satang * quantity);
  }

  equals(other: Money): boolean {
    return this.satang === other.satang;
  }
}
