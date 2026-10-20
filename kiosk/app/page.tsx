'use client';

import { Kiosk } from '../components/Kiosk';
import { createApi } from '../lib/api';
import { unavailableVoiceLink } from '../lib/voice-link';

const api = createApi();

export default function KioskPage() {
  return <Kiosk api={api} voice={unavailableVoiceLink} />;
}
