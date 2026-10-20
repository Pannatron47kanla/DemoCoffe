import { VoiceConsentText } from '../../domain/voice-consent-text';
import type { VoiceConnection } from '../../domain/voice-connection';
import type { ConsentTexts, VoiceGateway } from '../ports';

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
