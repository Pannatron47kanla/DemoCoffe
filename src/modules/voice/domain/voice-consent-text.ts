// ข้อความยินยอมเรื่องเสียงของเวอร์ชันหนึ่ง (R10)
export class VoiceConsentText {
  private constructor(
    readonly version: string,
    readonly text: string,
  ) {}

  static of(version: string, text: string): VoiceConsentText {
    return new VoiceConsentText(version, text);
  }
}
