import type { VoiceConsentText } from '../domain/voice-consent-text';
import { assertVoiceAvailable } from '../domain/voice-availability';
import type { ConsentTexts, VoiceGateway } from './ports';

export class GetVoiceConsentText {
  constructor(
    private readonly deps: {
      consentTexts: ConsentTexts;
      gateway: VoiceGateway;
    },
  ) {}

  async execute(): Promise<VoiceConsentText> {
    assertVoiceAvailable(this.deps.gateway.available); // AC10
    return this.deps.consentTexts.current();
  }
}
