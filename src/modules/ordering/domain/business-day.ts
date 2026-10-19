// R10 วันทำการตามเวลา Asia/Bangkok ใช้รีเซ็ตหมายเลขคิว
const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export class BusinessDay {
  static readonly TIME_ZONE = 'Asia/Bangkok';

  private constructor(readonly value: string) {}

  static of(instant: Date): BusinessDay {
    return new BusinessDay(bangkokDate.format(instant)); // YYYY-MM-DD
  }

  static restore(value: string): BusinessDay {
    return new BusinessDay(value);
  }
}
