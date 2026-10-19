// R10 เลขเรียงต่อวันทำการ เริ่มที่ 1 (ตัวนับจริงอยู่ที่ QueueNumberSequence)
export class QueueNumber {
  private constructor(readonly value: number) {}

  static of(value: number): QueueNumber {
    if (!Number.isInteger(value) || value < 1) throw new RangeError(`invalid queue number: ${value}`);
    return new QueueNumber(value);
  }
}
