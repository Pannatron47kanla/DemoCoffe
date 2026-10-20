import type { VoiceConsentText } from '../domain/voice-consent-text';
import type { ConsentTexts, VoiceGateway } from './ports';

export class GetVoiceConsentText {
  constructor(
    private readonly deps: {
      consentTexts: ConsentTexts;
      gateway: VoiceGateway;
    },
  ) {}

  execute(): Promise<VoiceConsentText> {
    return this.deps.consentTexts.current();
  }
}
