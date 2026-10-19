export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

// สำหรับเทสต์: เวลาคงที่ เลื่อนได้ด้วย advance()
export function fixedClock(at: Date | string) {
  let current = new Date(at);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    set(next: Date | string) {
      current = new Date(next);
    },
  };
}
