import express, { type Express } from 'express';
import { JsonMenuRepository, menuRoutes } from './modules/menu';
import { createOrderingModule, PgUnitOfWork, type MenuLookup } from './modules/ordering';
import { createVoiceModule, JsonVoiceConsentTexts, PgVoiceSessionRepository, type VoiceGateway } from './modules/voice';
import type { Clock } from './shared/clock';
import type { Pool } from './shared/db';
import { errorHandler } from './shared/http-errors';
import type { IdGenerator } from './shared/ids';

// ประกอบทุก module; ordering ได้ menu ผ่าน port MenuLookup เท่านั้น
type VoiceOptions = { gateway: VoiceGateway; consentPath: string; kioskId: string };

export async function createApp({ pool, menuPath, clock, ids, voice, publicBaseUrl, kioskDir }: { pool: Pool; menuPath: string; clock: Clock; ids: IdGenerator; voice: VoiceOptions; publicBaseUrl?: string | undefined; kioskDir?: string | undefined }): Promise<Express> {
  const menuRepository = await JsonMenuRepository.load(menuPath);
  const menu: MenuLookup = { findByIds: (menuItemIds) => menuRepository.findByIds(menuItemIds) };
  const ordering = createOrderingModule({ uow: new PgUnitOfWork(pool), menu, clock, ids, publicBaseUrl });
  const voiceModule = createVoiceModule({
    sessions: new PgVoiceSessionRepository(pool),
    carts: ordering.cartAvailability,
    consentTexts: new JsonVoiceConsentTexts(voice.consentPath),
    gateway: voice.gateway,
    cartOperations: ordering.voiceCart,
    menu: { current: () => menuRepository.all() },
    clock,
    ids,
    kioskId: voice.kioskId,
  });

  const app = express();
  app.use(express.json());
  app.use(menuRoutes(menuRepository));
  app.use(ordering.router);
  app.use(voiceModule.router);
  if (kioskDir) app.use(express.static(kioskDir)); // หน้าตู้ (static export ของ kiosk/) จาก origin เดียวกับ API
  app.use(errorHandler);
  return app;
}
