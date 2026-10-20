import { Router } from 'express';
import type { GetVoiceConsentText } from '../../application/get-voice-consent-text';
import type { StartVoiceSession } from '../../application/start-voice-session';
import { RequestValidationError } from '../../../../shared/http-errors';
import { toConsentTextJson, toVoiceSessionJson } from './mapper';

export interface VoiceUseCases {
  getVoiceConsentText: GetVoiceConsentText;
  startVoiceSession: StartVoiceSession;
}

// AC5 ตรวจเฉพาะชนิดและค่าว่าง รูปแบบ uuid ของ cartId ตรวจแยก (AC6)
function startSessionBody(body: unknown): { cartId: string; consentTextVersion: string } {
  const { cartId, consentTextVersion } = (body ?? {}) as Record<string, unknown>;
  const invalid = [
    ['cartId', cartId],
    ['consentTextVersion', consentTextVersion],
  ].filter(([, value]) => typeof value !== 'string' || value === '').map(([name]) => name as string);
  if (invalid.length > 0) throw new RequestValidationError(invalid);
  return { cartId: cartId as string, consentTextVersion: consentTextVersion as string };
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
      const { session, connection, created } = await useCases.startVoiceSession.execute(startSessionBody(req.body));
      res.status(created ? 201 : 200).json(toVoiceSessionJson(session, connection));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
