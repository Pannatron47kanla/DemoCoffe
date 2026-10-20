import { Router } from 'express';
import type { CallVoiceFunction } from '../../application/call-voice-function';
import type { VoiceFunctionCall } from '../../domain/voice-function-call';
import type { GetVoiceConsentText } from '../../application/get-voice-consent-text';
import type { StartVoiceSession } from '../../application/start-voice-session';
import { DomainError } from '../../../../shared/domain-error';
import { RequestValidationError } from '../../../../shared/http-errors';
import { toConsentTextJson, toFunctionResultJson, toVoiceSessionJson } from './mapper';

export interface VoiceUseCases {
  getVoiceConsentText: GetVoiceConsentText;
  startVoiceSession: StartVoiceSession;
  callVoiceFunction: CallVoiceFunction;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// AC5 ตรวจเฉพาะชนิดและค่าว่าง รูปแบบ uuid ของ cartId ตรวจแยก (AC6)
function startSessionBody(body: unknown): { cartId: string; consentTextVersion: string } {
  const { cartId, consentTextVersion } = (body ?? {}) as Record<string, unknown>;
  const invalid = [
    ['cartId', cartId],
    ['consentTextVersion', consentTextVersion],
  ].filter(([, value]) => typeof value !== 'string' || value === '').map(([name]) => name as string);
  if (invalid.length > 0) throw new RequestValidationError(invalid);
  // id ที่ไม่ใช่ uuid ไม่มีทางมีอยู่จริง ตอบเหมือนไม่พบ (AC6) ตรวจหลังรูปแบบ body
  if (!UUID.test(cartId as string)) throw new DomainError('CART_NOT_FOUND');
  return { cartId: cartId as string, consentTextVersion: consentTextVersion as string };
}

// แปลง body เป็นรูปที่มีชนิด ไม่ spread args เพื่อไม่ส่งฟิลด์เกินต่อ (AC16 จะตรวจครบ)
function functionCallBody(body: unknown): VoiceFunctionCall {
  const { name, args } = (body ?? {}) as { name?: unknown; args?: Record<string, unknown> };
  const a = args ?? {};
  switch (name) {
    case 'add_to_cart':
      return {
        name,
        menuItemId: a.menuItemId as string,
        optionChoiceIds: (a.optionChoiceIds as string[] | undefined) ?? [],
        quantity: a.quantity as number,
      };
    case 'change_quantity':
      return { name, lineId: a.lineId as string, quantity: a.quantity as number };
    case 'remove_from_cart':
      return { name, lineId: a.lineId as string };
    default:
      throw new RequestValidationError(['name']);
  }
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

  router.post('/voice/sessions/:sessionId/function-calls', async (req, res, next) => {
    try {
      const call = functionCallBody(req.body);
      // id ที่ไม่ใช่ uuid ไม่มีทางมีอยู่จริง ตอบเหมือนไม่พบ
      if (!UUID.test(req.params.sessionId!)) throw new DomainError('VOICE_SESSION_NOT_FOUND');
      res.json(toFunctionResultJson(await useCases.callVoiceFunction.execute({ sessionId: req.params.sessionId!, call })));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
