import type { Pool } from '../../../shared/db';
import type { VoiceSessionRepository } from '../domain/repositories';
import { VoiceSession } from '../domain/voice-session';

interface Row { id: string; cart_id: string; kiosk_id: string; consent_text_version: string; consented_at: Date }

export class PgVoiceSessionRepository implements VoiceSessionRepository {
  constructor(private readonly pool: Pool) {}

  async findByCartId(cartId: string): Promise<VoiceSession | null> {
    const { rows: [row] } = await this.pool.query<Row>(
      'SELECT id, cart_id, kiosk_id, consent_text_version, consented_at FROM voice_sessions WHERE cart_id = $1',
      [cartId],
    );
    return row ? toSession(row) : null;
  }

  async add(session: VoiceSession): Promise<{ session: VoiceSession; created: boolean }> {
    const s = session.toState();
    await this.pool.query(
      'INSERT INTO voice_sessions (id, cart_id, kiosk_id, consent_text_version, consented_at) VALUES ($1, $2, $3, $4, $5)',
      [s.id, s.cartId, s.kioskId, s.consentTextVersion, s.consentedAt],
    );
    return { session, created: true };
  }
}

function toSession(row: Row): VoiceSession {
  return VoiceSession.restore({
    id: row.id, cartId: row.cart_id, kioskId: row.kiosk_id, consentTextVersion: row.consent_text_version, consentedAt: row.consented_at,
  });
}
