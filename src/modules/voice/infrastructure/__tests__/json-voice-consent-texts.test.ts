import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../shared/domain-error';
import { JsonVoiceConsentTexts } from '../json-voice-consent-texts';

const REAL_FILE = join(import.meta.dirname, '../../../../../data/voice-consent.json');

describe('JsonVoiceConsentTexts', () => {
  it('AC1: อ่าน data/voice-consent.json จริง ได้ voice-demo-v1 และข้อความตาม R10', async () => {
    const current = await new JsonVoiceConsentTexts(REAL_FILE).current();
    expect(current.version).toBe('voice-demo-v1');
    for (const part of ['Google', 'ปรับปรุงบริการ', 'ตรวจอ่าน', 'สิงคโปร์']) expect(current.text).toContain(part);
  });

  it('AC1: อ่านไฟล์ใหม่ทุกครั้ง แก้ไฟล์แล้วได้เวอร์ชันใหม่โดยไม่ต้องสร้างใหม่', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'voice-consent-')), 'consent.json');
    await writeFile(path, JSON.stringify({ version: 'voice-demo-v1', text: 'ข้อความ 1' }));
    const texts = new JsonVoiceConsentTexts(path);
    expect((await texts.current()).version).toBe('voice-demo-v1');
    await writeFile(path, JSON.stringify({ version: 'voice-demo-v2', text: 'ข้อความ 2' }));
    const next = await texts.current();
    expect(next.version).toBe('voice-demo-v2');
    expect(next.text).toBe('ข้อความ 2');
  });

  it('AC1: ไฟล์ไม่มีหรือ JSON เสีย → VOICE_UNAVAILABLE', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'voice-consent-'));
    const broken = join(dir, 'broken.json');
    await writeFile(broken, '{ not json');
    for (const path of [join(dir, 'missing.json'), broken]) {
      await expect(new JsonVoiceConsentTexts(path).current()).rejects.toMatchObject({ code: 'VOICE_UNAVAILABLE' });
      await expect(new JsonVoiceConsentTexts(path).current()).rejects.toBeInstanceOf(DomainError);
    }
  });
});
