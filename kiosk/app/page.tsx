'use client';

import { Kiosk } from '../components/Kiosk';
import { createApi } from '../lib/api';
import { geminiVoiceLink } from '../lib/gemini-voice-link';

const api = createApi();

export default function KioskPage() {
  return <Kiosk api={api} voice={geminiVoiceLink} />;
}
