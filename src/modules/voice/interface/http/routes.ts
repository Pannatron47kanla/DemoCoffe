import { Router } from 'express';
import type { GetVoiceConsentText } from '../../application/get-voice-consent-text';
import type { StartVoiceSession } from '../../application/start-voice-session';
import { toConsentTextJson, toVoiceSessionJson } from './mapper';

export interface VoiceUseCases {
  getVoiceConsentText: GetVoiceConsentText;
  startVoiceSession: StartVoiceSession;
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

  router.post('/voice/sessions', async (req, res, next) => {
    try {
      // ตรวจ body จริงเพิ่มใน AC5
      const { cartId, consentTextVersion } = req.body as { cartId: string; consentTextVersion: string };
      const { session, connection, created } = await useCases.startVoiceSession.execute({ cartId, consentTextVersion });
      res.status(created ? 201 : 200).json(toVoiceSessionJson(session, connection));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
