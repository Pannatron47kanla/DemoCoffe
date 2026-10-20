import { VoiceConsentText } from '../../domain/voice-consent-text';
import type { VoiceConnection } from '../../domain/voice-connection';
import { DomainError } from '../../../../shared/domain-error';
import type { VoiceSessionRepository } from '../../domain/repositories';
import { VoiceSession, type VoiceSessionState } from '../../domain/voice-session';
import type { VoiceMenuItem } from '../../domain/voice-menu';
import type { CartAvailability, CartSnapshot, ConsentTexts, VoiceCartOperations, VoiceGateway, VoiceMenu, VoiceSetup } from '../ports';

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
  setups: VoiceSetup[] = [];
  async issueConnection(now: Date, setup: VoiceSetup): Promise<VoiceConnection> {
    this.calls.push(now);
    this.setups.push(setup);
    if (this.fail) throw new DomainError('VOICE_UNAVAILABLE');
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

  async findById(id: string): Promise<VoiceSession | null> {
    const state = [...this.byCart.values()].find((s) => s.id === id);
    return state ? VoiceSession.restore(structuredClone(state)) : null;
  }

  async add(session: VoiceSession): Promise<{ session: VoiceSession; created: boolean }> {
    this.addCalls += 1;
    // เช็กและเขียนในจังหวะเดียว (ไม่ await คั่น) เลียนแบบ ON CONFLICT ของ DB (AC13)
    const existing = this.byCart.get(session.cartId);
    if (existing) return { session: VoiceSession.restore(structuredClone(existing)), created: false };
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

export class FakeVoiceMenu implements VoiceMenu {
  items: VoiceMenuItem[] = [
    { id: 'latte', name: 'ลาเต้', basePriceSatang: 5500, available: true, optionGroups: [] },
    { id: 'espresso', name: 'เอสเพรสโซ่', basePriceSatang: 4500, available: true, optionGroups: [] },
  ];
  async current(): Promise<VoiceMenuItem[]> {
    return this.items;
  }
}

export class FakeVoiceCartOperations implements VoiceCartOperations {
  calls: { op: string; cartId: string; args: unknown[] }[] = [];
  rejectWith?: string;

  private async record(op: string, cartId: string, args: unknown[]): Promise<CartSnapshot> {
    this.calls.push({ op, cartId, args });
    if (this.rejectWith) throw new DomainError(this.rejectWith);
    return { id: cartId };
  }
  add(cartId: string, input: { menuItemId: string; optionChoiceIds: string[]; quantity: number }) {
    return this.record('add', cartId, [input]);
  }
  changeQuantity(cartId: string, lineId: string, quantity: number) {
    return this.record('changeQuantity', cartId, [lineId, quantity]);
  }
  remove(cartId: string, lineId: string) {
    return this.record('remove', cartId, [lineId]);
  }
  view(cartId: string) {
    return this.record('view', cartId, []);
  }
  readyForCheckout(cartId: string) {
    return this.record('readyForCheckout', cartId, []);
  }
}
