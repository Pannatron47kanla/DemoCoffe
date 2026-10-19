import type { DbClient } from '../../../shared/db';
import type { BusinessDay } from '../domain/business-day';
import { QueueNumber } from '../domain/queue-number';
import type { QueueNumberSequence } from '../domain/repositories';

// upsert ล็อกแถวของวันนั้นจน transaction จบ การยืนยันพร้อมกันจึงได้เลขไม่ซ้ำและไม่ข้าม (AC23)
export class PgQueueNumberSequence implements QueueNumberSequence {
  constructor(private readonly db: DbClient) {}

  async next(day: BusinessDay): Promise<QueueNumber> {
    const { rows: [row] } = await this.db.query<{ last_number: number }>(
      `INSERT INTO queue_counters (business_day, last_number) VALUES ($1, 1)
       ON CONFLICT (business_day) DO UPDATE SET last_number = queue_counters.last_number + 1, updated_at = now()
       RETURNING last_number`,
      [day.value],
    );
    return QueueNumber.of(row!.last_number);
  }
}
