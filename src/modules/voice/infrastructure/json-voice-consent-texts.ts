import { readFile } from 'node:fs/promises';
import { DomainError } from '../../../shared/domain-error';
import type { ConsentTexts } from '../application/ports';
import { VoiceConsentText } from '../domain/voice-consent-text';

// อ่านไฟล์ใหม่ทุกครั้ง เพื่อเปลี่ยนเวอร์ชันได้โดยไม่ต้อง restart (R10)
export class JsonVoiceConsentTexts implements ConsentTexts {
  constructor(private readonly path: string) {}

  async current(): Promise<VoiceConsentText> {
    try {
      const { version, text } = JSON.parse(await readFile(this.path, 'utf8')) as { version?: unknown; text?: unknown };
      if (typeof version !== 'string' || version === '' || typeof text !== 'string' || text === '') throw new Error('invalid consent file');
      return VoiceConsentText.of(version, text);
    } catch {
      throw new DomainError('VOICE_UNAVAILABLE');
    }
  }
}
