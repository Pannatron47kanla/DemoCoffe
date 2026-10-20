import type { VoiceConsentText } from '../../domain/voice-consent-text';

export function toConsentTextJson(consent: VoiceConsentText) {
  return { version: consent.version, text: consent.text };
}
