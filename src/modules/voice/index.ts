// สิ่งเดียวที่ context อื่นและ app.ts import ได้จาก voice
export { createVoiceModule } from './module';
export type { VoiceCartOperations, VoiceGateway, VoiceMenu } from './application/ports';
export { unavailableVoiceGateway } from './infrastructure/unavailable-voice-gateway';
export { AiStudioVoiceGateway, type AuthTokens } from './infrastructure/ai-studio-voice-gateway';
export { loadVoiceConfig, type VoiceConfig } from './voice-config';
export { JsonVoiceConsentTexts } from './infrastructure/json-voice-consent-texts';
export { PgVoiceSessionRepository } from './infrastructure/pg-voice-session-repository';
