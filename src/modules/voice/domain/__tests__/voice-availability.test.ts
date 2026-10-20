import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../shared/domain-error';
import { assertVoiceAvailable } from '../voice-availability';

describe('assertVoiceAvailable', () => {
  it('AC10: assertVoiceAvailable(false) → VOICE_UNAVAILABLE', () => {
    expect(() => assertVoiceAvailable(false)).toThrow(DomainError);
    expect(() => assertVoiceAvailable(false)).toThrow(expect.objectContaining({ code: 'VOICE_UNAVAILABLE' }));
  });

  it('AC10: assertVoiceAvailable(true) ไม่โยน', () => {
    expect(() => assertVoiceAvailable(true)).not.toThrow();
  });
});
