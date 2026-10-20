import { VoiceConsentText } from '../../domain/voice-consent-text';
import type { VoiceConnection } from '../../domain/voice-connection';
import { DomainError } from '../../../../shared/domain-error';
import type { VoiceSessionRepository } from '../../domain/repositories';
import { VoiceSession, type VoiceSessionState } from '../../domain/voice-session';
import type { CartAvailability, ConsentTexts, VoiceGateway } from '../ports';

export class FakeConsentTexts implements ConsentTexts {
  text = VoiceConsentText.of('voice-demo-v1', 'เสียงของคุณจะถูกส่งไปยัง Google (ข้อความทดสอบ)');
  async current(): Promise<VoiceConsentText> {
    return this.text;
  }
}

export class FakeVoiceGateway implements VoiceGateway {
  available = true;
  fail = false;
  calls: Date[] = [];
  async issueConnection(now: Date): Promise<VoiceConnection> {
    this.calls.push(now);
    return {
      token: `auth_tokens/fake-${this.calls.length}`,
      model: 'gemini-3.8-live',
      startBefore: new Date(now.getTime() + 60_000),
    };
  }
}

export class InMemoryVoiceSessions implements VoiceSessionRepository {
  private readonly byCart = new Map<string, VoiceSessionState>();
  addCalls = 0;

  async findByCartId(cartId: string): Promise<VoiceSession | null> {
    const state = this.byCart.get(cartId);
    return state ? VoiceSession.restore(structuredClone(state)) : null;
  }

  async add(session: VoiceSession): Promise<{ session: VoiceSession; created: boolean }> {
    this.addCalls += 1;
    const existing = await this.findByCartId(session.cartId);
    if (existing) return { session: existing, created: false };
    this.byCart.set(session.cartId, structuredClone(session.toState()));
    return { session, created: true };
  }

  count(): number {
    return this.byCart.size;
  }
}

export class FakeCartAvailability implements CartAvailability {
  rejectWith?: string;
  async assertOpen(): Promise<void> {
    if (this.rejectWith) throw new DomainError(this.rejectWith);
  }
}
