import type { Router } from 'express';
import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/ids';
import { CallVoiceFunction } from './application/call-voice-function';
import { GetVoiceConsentText } from './application/get-voice-consent-text';
import type { CartAvailability, ConsentTexts, VoiceCartOperations, VoiceGateway, VoiceMenu } from './application/ports';
import { StartVoiceSession } from './application/start-voice-session';
import type { VoiceSessionRepository } from './domain/repositories';
import { voiceRoutes } from './interface/http/routes';

// ต่อสายชิ้นส่วนของ voice; main/app ส่งของจริงเข้ามา
export function createVoiceModule(deps: {
  sessions: VoiceSessionRepository; carts: CartAvailability; consentTexts: ConsentTexts; gateway: VoiceGateway; menu: VoiceMenu;
  cartOperations: VoiceCartOperations;
  clock: Clock; ids: IdGenerator; kioskId: string;
}): { useCases: ReturnType<typeof buildUseCases>; router: Router } {
  const useCases = buildUseCases(deps);
  return { useCases, router: voiceRoutes(useCases) };
}

function buildUseCases(deps: Parameters<typeof createVoiceModule>[0]) {
  return { getVoiceConsentText: new GetVoiceConsentText(deps), startVoiceSession: new StartVoiceSession(deps), callVoiceFunction: new CallVoiceFunction(deps) };
}
