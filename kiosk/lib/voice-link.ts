import type { VoiceSession } from './types';

export type FunctionCall = { id: string; name: string; args: Record<string, unknown> };

export interface VoiceLinkHandlers {
  onFunctionCalls(calls: FunctionCall[]): void;
  onTranscript(role: 'user' | 'model', text: string): void;
  onClose(reason: 'closed' | 'error'): void;
}

export interface VoiceLinkSession {
  sendFunctionResponses(responses: { id: string; name: string; response: unknown }[]): void;
  close(): void;
}

export interface VoiceLink {
  connect(connection: VoiceSession['connection'], handlers: VoiceLinkHandlers): Promise<VoiceLinkSession>;
}

// ใช้ชั่วคราวจนกว่าจะมี link จริง (Gemini Live)
export const unavailableVoiceLink: VoiceLink = {
  connect: () => Promise.reject(new Error('voice link unavailable')),
};
