import { GoogleGenAI, Modality, type Session } from '@google/genai';
import { parseLiveMessage, toFunctionResponses } from './live-messages';
import { floatToPcm16Base64, pcm16Base64ToFloat } from './pcm';
import type { VoiceLink, VoiceLinkHandlers, VoiceLinkSession } from './voice-link';

const INPUT_MIME = 'audio/pcm;rate=16000';
const OUTPUT_RATE = 24_000;
// ถ้า Gemini ไม่ตอบ setupComplete ภายในเวลานี้ ถือว่าเปิดเสียงไม่ได้ (UI แสดงข้อความใช้เสียงไม่ได้)
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * ต่อ Gemini Live ด้วยโทเคนชั่วคราวจาก api (ใช้ครั้งเดียว) โทเคนล็อกรุ่น เครื่องมือ ภาษา และคำบรรยายไว้แล้ว
 * ฝั่งตู้ส่งแค่ responseModalities ที่ตรงกับที่ล็อกไว้ ห้าม log โทเคน
 */
export const geminiVoiceLink: VoiceLink = {
  async connect(connection, handlers) {
    // ขอไมโครโฟนก่อน ถ้าลูกค้า/เครื่องไม่อนุญาต connect ล้มทันที (UI แสดงข้อความใช้เสียงไม่ได้)
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    const audio = new LiveAudio(mic);
    try {
      await audio.start();
      const session = await openSession(connection, handlers, audio);
      audio.onChunk = (samples) => session.sendRealtimeInput({ audio: { data: floatToPcm16Base64(samples), mimeType: INPUT_MIME } });
      return session.link;
    } catch (error) {
      audio.stop();
      throw error;
    }
  },
};

type Opened = { link: VoiceLinkSession; sendRealtimeInput: Session['sendRealtimeInput'] };

function openSession(connection: Parameters<VoiceLink['connect']>[0], handlers: VoiceLinkHandlers, audio: LiveAudio): Promise<Opened> {
  return new Promise<Opened>((resolve, reject) => {
    let state: 'connecting' | 'open' | 'done' = 'connecting';
    let session: Session | undefined;
    const fail = (error: Error) => {
      if (state !== 'connecting') return;
      state = 'done';
      clearTimeout(timer);
      session?.close();
      reject(error);
    };
    // ปิดครั้งเดียว: ตู้ปิดเอง = 'closed', socket error หรือหลุดเอง = 'error' (UC-04 R4)
    const finish = (reason: 'closed' | 'error') => {
      if (state !== 'open') return;
      state = 'done';
      audio.stop();
      session?.close();
      handlers.onClose(reason);
    };
    const timer = setTimeout(() => fail(new Error('voice link setup timed out')), CONNECT_TIMEOUT_MS);

    const ai = new GoogleGenAI({ apiKey: connection.token, httpOptions: { apiVersion: 'v1alpha' } });
    ai.live
      .connect({
        model: connection.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: (msg) => {
            if (state !== 'open') return;
            for (const event of parseLiveMessage(msg)) {
              if (event.type === 'functionCalls') handlers.onFunctionCalls(event.calls);
              else if (event.type === 'transcript') handlers.onTranscript(event.role, event.text);
              else if (event.type === 'audio') audio.play(event.base64);
              else audio.interrupt();
            }
          },
          onerror: () => {
            fail(new Error('voice link socket error'));
            finish('error');
          },
          onclose: () => {
            fail(new Error('voice link closed during setup'));
            finish('error');
          },
        },
      })
      .then(
        (opened) => {
          session = opened;
          if (state !== 'connecting') {
            opened.close(); // หมดเวลาหรือหลุดไปแล้วระหว่างรอ
            return;
          }
          state = 'open';
          clearTimeout(timer);
          resolve({
            sendRealtimeInput: (params) => {
              if (state === 'open') opened.sendRealtimeInput(params);
            },
            link: {
              sendFunctionResponses: (responses) => {
                if (state === 'open') opened.sendToolResponse({ functionResponses: toFunctionResponses(responses) });
              },
              close: () => finish('closed'),
            },
          });
        },
        (error: unknown) => fail(error instanceof Error ? error : new Error('voice link connect failed')),
      );
  });
}

/** ไมโครโฟน (AudioWorklet → 16 kHz) และเสียงตอบ (24 kHz ต่อคิว) ของหนึ่งเซสชัน */
class LiveAudio {
  onChunk: ((samples: Float32Array) => void) | null = null;
  private micContext: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private playback: AudioContext | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private stopped = false;

  constructor(private readonly mic: MediaStream) {}

  async start(): Promise<void> {
    this.micContext = new AudioContext();
    this.playback = new AudioContext({ sampleRate: OUTPUT_RATE });
    await this.micContext.audioWorklet.addModule('/mic-worklet.js');
    if (this.stopped) return;
    this.source = this.micContext.createMediaStreamSource(this.mic);
    this.worklet = new AudioWorkletNode(this.micContext, 'mic-resampler', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 });
    this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!this.stopped) this.onChunk?.(e.data);
    };
    this.source.connect(this.worklet);
    await Promise.all([this.micContext.resume(), this.playback.resume()]);
  }

  play(base64: string): void {
    const ctx = this.playback;
    if (this.stopped || !ctx) return;
    const samples = pcm16Base64ToFloat(base64);
    if (samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.onended = () => this.playing.delete(node);
    // ต่อท้ายคิวให้เล่นต่อเนื่องไม่มีช่องว่าง
    this.nextStart = Math.max(this.nextStart, ctx.currentTime);
    node.start(this.nextStart);
    this.nextStart += buffer.duration;
    this.playing.add(node);
  }

  /** ลูกค้าพูดแทรก: หยุดเสียงที่เล่นอยู่และล้างคิว */
  interrupt(): void {
    for (const node of this.playing) {
      try {
        node.stop();
      } catch {
        // ยังไม่เริ่มหรือจบไปแล้ว
      }
    }
    this.playing.clear();
    this.nextStart = 0;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onChunk = null;
    this.interrupt();
    for (const track of this.mic.getTracks()) track.stop();
    if (this.worklet) this.worklet.port.onmessage = null;
    this.source?.disconnect();
    this.worklet?.disconnect();
    void this.micContext?.close().catch(() => undefined);
    void this.playback?.close().catch(() => undefined);
  }
}
