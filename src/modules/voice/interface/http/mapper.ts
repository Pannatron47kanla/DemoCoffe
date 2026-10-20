import type { VoiceConnection } from '../../domain/voice-connection';
import type { VoiceConsentText } from '../../domain/voice-consent-text';
import type { VoiceSession } from '../../domain/voice-session';

export function toConsentTextJson(consent: VoiceConsentText) {
  return { version: consent.version, text: consent.text };
}

export function toVoiceSessionJson(session: VoiceSession, connection: VoiceConnection) {
  return {
    id: session.id,
    cartId: session.cartId,
    consentTextVersion: session.consentTextVersion,
    consentedAt: session.consentedAt.toISOString(),
    connection: { token: connection.token, model: connection.model, startBefore: connection.startBefore.toISOString() },
  };
}
