import type { Clock } from '../../../shared/clock';
import type { IdGenerator } from '../../../shared/ids';
import type { VoiceConnection } from '../domain/voice-connection';
import type { VoiceSessionRepository } from '../domain/repositories';
import { assertVoiceAvailable } from '../domain/voice-availability';
import { buildVoiceInstructions } from '../domain/voice-instructions';
import { VoiceSession } from '../domain/voice-session';
import type { CartAvailability, ConsentTexts, VoiceGateway, VoiceMenu } from './ports';

export class StartVoiceSession {
  constructor(
    private readonly deps: {
      sessions: VoiceSessionRepository;
      carts: CartAvailability;
      consentTexts: ConsentTexts;
      gateway: VoiceGateway;
      menu: VoiceMenu;
      clock: Clock;
      ids: IdGenerator;
      kioskId: string;
    },
  ) {}

  async execute(input: { cartId: string; consentTextVersion: string }): Promise<{ session: VoiceSession; connection: VoiceConnection; created: boolean }> {
    const { sessions, carts, consentTexts, gateway, menu, clock, ids, kioskId } = this.deps;
    assertVoiceAvailable(gateway.available); // ปิดเสียงต้องหยุดก่อนแตะตะกร้า (AC10)
    const now = clock.now();

    await carts.assertOpen(input.cartId);
    let session = await sessions.findByCartId(input.cartId);
    let created = false;
    if (!session) {
      const current = await consentTexts.current();
      ({ session, created } = await sessions.add(
        VoiceSession.consent({ id: ids(), cartId: input.cartId, kioskId, shownVersion: input.consentTextVersion, current, now }),
      ));
    }
    // บันทึกความยินยอมก่อน แล้วอ่านเมนูล่าสุดล็อกลงโทเคน (AC1)
    const systemInstruction = buildVoiceInstructions(await menu.current());
    const connection = await gateway.issueConnection(now, { systemInstruction });
    return { session, connection, created };
  }
}
