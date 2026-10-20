import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../../../../tests/support/postgres';
import { VoiceSession } from '../../domain/voice-session';
import { VoiceConsentText } from '../../domain/voice-consent-text';
import { PgVoiceSessionRepository } from '../pg-voice-session-repository';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const T0 = new Date('2026-10-20T02:30:00Z');

let db: TestDatabase;
let repo: PgVoiceSessionRepository;

beforeAll(async () => {
  db = await startTestDatabase();
  repo = new PgVoiceSessionRepository(db.pool);
});
afterAll(() => db?.stop());
beforeEach(() => db.reset());

describe('PgVoiceSessionRepository', () => {
  it('AC2: add แล้ว findByCartId ได้ข้อมูลเดิมครบ', async () => {
    // FK: voice_sessions.cart_id อ้าง carts
    await db.pool.query("INSERT INTO carts (id, status, last_activity_at) VALUES ($1, 'OPEN', $2)", [id(2), T0]);
    const session = VoiceSession.consent({
      id: id(1), cartId: id(2), kioskId: 'kiosk-1', shownVersion: 'voice-demo-v1',
      current: VoiceConsentText.of('voice-demo-v1', 'ข้อความทดสอบ'), now: T0,
    });

    const added = await repo.add(session);
    const found = await repo.findByCartId(id(2));

    expect(added.created).toBe(true);
    expect(added.session.toState()).toEqual(session.toState());
    expect(found?.toState()).toEqual(session.toState());
  });

  it('AC3: voice_sessions มีเฉพาะคอลัมน์หลักฐาน ไม่มีข้อมูลบุคคลหรือเสียง', async () => {
    const { rows } = await db.pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_sessions' ORDER BY ordinal_position",
    );

    expect(rows.map((r) => r.column_name)).toEqual([
      'id', 'cart_id', 'kiosk_id', 'consent_text_version', 'consented_at', 'created_at', 'updated_at',
    ]);
  });
});
