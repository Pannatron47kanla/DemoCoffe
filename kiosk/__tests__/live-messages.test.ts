import type { LiveServerMessage } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { parseLiveMessage, toFunctionResponses } from '../lib/live-messages';

const msg = (m: object) => m as LiveServerMessage;

describe('UC-04 parseLiveMessage', () => {
  it('AC15: parseLiveMessage แยก toolCall คำบรรยาย เสียง และ interrupted', () => {
    expect(
      parseLiveMessage(msg({
        toolCall: {
          functionCalls: [
            { id: 'a', name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 1 } },
            { id: 'b', name: 'view_cart' },
          ],
        },
      })),
    ).toEqual([
      {
        type: 'functionCalls',
        calls: [
          { id: 'a', name: 'add_to_cart', args: { menuItemId: 'latte', quantity: 1 } },
          { id: 'b', name: 'view_cart', args: {} },
        ],
      },
    ]);

    expect(
      parseLiveMessage(msg({
        serverContent: {
          inputTranscription: { text: 'ขอลาเต้' },
          outputTranscription: { text: 'ได้เลยค่ะ' },
          modelTurn: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/pcm;rate=24000' } }, { text: 'คิด' }, { inlineData: { data: 'BBBB' } }] },
        },
      })),
    ).toEqual([
      { type: 'transcript', role: 'user', text: 'ขอลาเต้' },
      { type: 'transcript', role: 'model', text: 'ได้เลยค่ะ' },
      { type: 'audio', base64: 'AAAA' },
      { type: 'audio', base64: 'BBBB' },
    ]);

    expect(parseLiveMessage(msg({ serverContent: { interrupted: true } }))).toEqual([{ type: 'interrupted' }]);
    // ข้อความที่ไม่เกี่ยว (setupComplete, คำบรรยายว่าง, turnComplete) ไม่มี event
    expect(parseLiveMessage(msg({ setupComplete: {} }))).toEqual([]);
    expect(parseLiveMessage(msg({ serverContent: { inputTranscription: { text: '' }, turnComplete: true } }))).toEqual([]);
  });

  it('AC15: ตอบ function ด้วย response ที่เป็น object เสมอ', () => {
    expect(
      toFunctionResponses([
        { id: 'a', name: 'add_to_cart', response: { action: 'SHOW_CART' } },
        { id: 'b', name: 'view_cart', response: 'ข้อความ' },
      ]),
    ).toEqual([
      { id: 'a', name: 'add_to_cart', response: { action: 'SHOW_CART' } },
      { id: 'b', name: 'view_cart', response: { output: 'ข้อความ' } },
    ]);
  });
});
