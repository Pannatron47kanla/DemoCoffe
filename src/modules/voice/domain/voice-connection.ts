// ข้อมูลที่ตู้ใช้ต่อ Gemini Live เอง
export interface VoiceConnection {
  token: string;
  model: string;
  startBefore: Date;
}

export const VOICE_CONNECTION = {
  START_WITHIN_SECONDS: 60,
  TOKEN_LIFETIME_MINUTES: 15,
  ISSUE_TIMEOUT_MS: 3000,
} as const;
