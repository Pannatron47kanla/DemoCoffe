import { DomainError } from '../../../shared/domain-error';

// ปิดใช้เสียงในการตั้งค่า ต้องไม่แตะตะกร้าหรือบันทึกใดๆ (AC10)
export function assertVoiceAvailable(available: boolean): void {
  if (!available) throw new DomainError('VOICE_UNAVAILABLE');
}
