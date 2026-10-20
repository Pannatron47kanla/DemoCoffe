import { Router } from 'express';
import type { GetVoiceConsentText } from '../../application/get-voice-consent-text';
import { toConsentTextJson } from './mapper';

export interface VoiceUseCases {
  getVoiceConsentText: GetVoiceConsentText;
}

export function voiceRoutes(useCases: VoiceUseCases): Router {
  const router = Router();

  router.get('/voice/consent-text', async (_req, res, next) => {
    try {
      res.json(toConsentTextJson(await useCases.getVoiceConsentText.execute()));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
