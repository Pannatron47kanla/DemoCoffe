import type { FunctionResponse, LiveServerMessage } from '@google/genai';
import type { FunctionCall } from './voice-link';

export type LiveEvent =
  | { type: 'functionCalls'; calls: FunctionCall[] }
  | { type: 'transcript'; role: 'user' | 'model'; text: string }
  | { type: 'audio'; base64: string }
  | { type: 'interrupted' };

/**
 * แปลงข้อความจาก Gemini Live เป็น event ที่ตู้ใช้ ตามลำดับ: function call → interrupted → คำบรรยาย → เสียง
 * (interrupted มาก่อนเสียง เพื่อให้การล้างคิวไม่ลบเสียงใหม่ในข้อความเดียวกัน)
 */
export function parseLiveMessage(msg: LiveServerMessage): LiveEvent[] {
  const events: LiveEvent[] = [];
  const calls = msg.toolCall?.functionCalls ?? [];
  if (calls.length > 0) {
    events.push({
      type: 'functionCalls',
      calls: calls.map((c) => ({ id: c.id ?? '', name: c.name ?? '', args: c.args ?? {} })),
    });
  }
  const content = msg.serverContent;
  if (!content) return events;
  if (content.interrupted) events.push({ type: 'interrupted' });
  const userText = content.inputTranscription?.text;
  if (userText) events.push({ type: 'transcript', role: 'user', text: userText });
  const modelText = content.outputTranscription?.text;
  if (modelText) events.push({ type: 'transcript', role: 'model', text: modelText });
  for (const part of content.modelTurn?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) events.push({ type: 'audio', base64: data });
  }
  return events;
}

/** Gemini รับ response เป็น object เท่านั้น ค่าอื่นห่อไว้ใน `output` */
export function toFunctionResponses(responses: { id: string; name: string; response: unknown }[]): FunctionResponse[] {
  return responses.map(({ id, name, response }) => ({
    id,
    name,
    response: typeof response === 'object' && response !== null && !Array.isArray(response) ? (response as Record<string, unknown>) : { output: response },
  }));
}
