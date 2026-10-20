import express, { type Express } from 'express';
import { JsonMenuRepository } from './modules/menu';
import { createOrderingModule, PgUnitOfWork, type MenuLookup } from './modules/ordering';
import { createVoiceModule, JsonVoiceConsentTexts, PgVoiceSessionRepository, type VoiceGateway } from './modules/voice';
import type { Clock } from './shared/clock';
import type { Pool } from './shared/db';
import { errorHandler } from './shared/http-errors';
import type { IdGenerator } from './shared/ids';

// ประกอบทุก module; ordering ได้ menu ผ่าน port MenuLookup เท่านั้น
type VoiceOptions = { gateway: VoiceGateway; consentPath: string; kioskId: string };

export async function createApp({ pool, menuPath, clock, ids, voice }: { pool: Pool; menuPath: string; clock: Clock; ids: IdGenerator; voice: VoiceOptions }): Promise<Express> {
  const menuRepository = await JsonMenuRepository.load(menuPath);
  const menu: MenuLookup = { findByIds: (menuItemIds) => menuRepository.findByIds(menuItemIds) };
  const ordering = createOrderingModule({ uow: new PgUnitOfWork(pool), menu, clock, ids });
  const voiceModule = createVoiceModule({
    sessions: new PgVoiceSessionRepository(pool),
    carts: ordering.cartAvailability,
    consentTexts: new JsonVoiceConsentTexts(voice.consentPath),
    gateway: voice.gateway,
    clock,
    ids,
    kioskId: voice.kioskId,
  });

  const app = express();
  app.use(express.json());
  app.use(ordering.router);
  app.use(voiceModule.router);
  app.use(errorHandler);
  return app;
}
