// สิ่งเดียวที่ context อื่นและ app.ts import ได้จาก voice
export { createVoiceModule } from './module';
export type { VoiceGateway } from './application/ports';
export { unavailableVoiceGateway } from './infrastructure/unavailable-voice-gateway';
export { JsonVoiceConsentTexts } from './infrastructure/json-voice-consent-texts';
