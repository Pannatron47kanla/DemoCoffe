import { randomUUID } from 'node:crypto';

export type IdGenerator = () => string;

export const randomIds: IdGenerator = () => randomUUID();

// สำหรับเทสต์: id เรียงกันอ่านง่าย
export function sequentialIds(prefix = '00000000-0000-4000-8000-'): IdGenerator {
  let n = 0;
  return () => prefix + String(++n).padStart(12, '0');
}
