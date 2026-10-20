import { GetVoiceConsentText } from './application/get-voice-consent-text';
import type { ConsentTexts, VoiceGateway } from './application/ports';
import { voiceRoutes } from './interface/http/routes';

// ต่อสายชิ้นส่วนของ voice; deps ที่เหลือ (sessions, carts, clock, ids) เพิ่มใน Task 2
export function createVoiceModule(deps: { consentTexts: ConsentTexts; gateway: VoiceGateway }) {
  const useCases = { getVoiceConsentText: new GetVoiceConsentText(deps) };
  return { useCases, router: voiceRoutes(useCases) };
}
