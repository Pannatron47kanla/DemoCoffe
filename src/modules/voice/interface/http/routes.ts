import { Router } from 'express';
import type { CallVoiceFunction } from '../../application/call-voice-function';
import { VOICE_FUNCTION_NAMES, type VoiceFunctionCall } from '../../domain/voice-function-call';
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

// AC16: ตรวจชนิดของ args ทีละฟังก์ชัน ไม่ spread args (ฟิลด์เกินถูกทิ้ง) args ที่ไม่ส่งถือเป็น {}
// ช่วงของจำนวนไม่ตรวจที่นี่ UC-01 ตอบ 409 เอง (R7)
const isString = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isLineId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function functionCallBody(body: unknown): VoiceFunctionCall {
  const { name, args } = (body ?? {}) as { name?: unknown; args?: unknown };
  if (!(VOICE_FUNCTION_NAMES as readonly unknown[]).includes(name)) throw new RequestValidationError(['name']);
  if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) throw new RequestValidationError(['args']);
  const a = (args ?? {}) as Record<string, unknown>;
  const need = (checks: [string, boolean][]) => {
    const invalid = checks.filter(([, ok]) => !ok).map(([field]) => field);
    if (invalid.length > 0) throw new RequestValidationError(invalid);
  };
  switch (name as (typeof VOICE_FUNCTION_NAMES)[number]) {
    case 'add_to_cart': {
      const choices = a.optionChoiceIds;
      need([
        ['menuItemId', isString(a.menuItemId)],
        ['optionChoiceIds', choices === undefined || (Array.isArray(choices) && choices.every((c) => typeof c === 'string'))],
        ['quantity', isInt(a.quantity)],
      ]);
      return { name: 'add_to_cart', menuItemId: a.menuItemId as string, optionChoiceIds: (choices as string[] | undefined) ?? [], quantity: a.quantity as number };
    }
    case 'change_quantity':
      need([['lineId', isLineId(a.lineId)], ['quantity', isInt(a.quantity)]]);
      return { name: 'change_quantity', lineId: a.lineId as string, quantity: a.quantity as number };
    case 'remove_from_cart':
      need([['lineId', isLineId(a.lineId)]]);
      return { name: 'remove_from_cart', lineId: a.lineId as string };
    case 'view_cart':
      return { name: 'view_cart' };
    case 'request_checkout':
      return { name: 'request_checkout' };
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
      // id ที่ไม่ใช่ uuid ไม่มีทางมีอยู่จริง ตอบเหมือนไม่พบ ตรวจ path ก่อน body (AC14 ก่อน AC16)
      if (!UUID.test(req.params.sessionId!)) throw new DomainError('VOICE_SESSION_NOT_FOUND');
      const call = functionCallBody(req.body);
      res.json(toFunctionResultJson(await useCases.callVoiceFunction.execute({ sessionId: req.params.sessionId!, call })));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
