// AudioWorklet: แปลงเสียงไมโครโฟนจาก sampleRate ของเครื่องเป็น 16 kHz โมโน (linear interpolation)
// แล้วส่ง Float32Array ทีละ 50 ms (800 sample) ให้ main thread แปลงเป็น PCM16 ส่ง Gemini Live
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 800;

class MicResampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE; // sampleRate เป็น global ของ AudioWorkletGlobalScope
    this.pos = 0; // ตำแหน่งที่จะอ่านถัดไป นับจากต้นบล็อกปัจจุบัน (-1 = sample สุดท้ายของบล็อกก่อน)
    this.prev = 0;
    this.out = new Float32Array(CHUNK_SAMPLES);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) return true;
    while (this.pos < input.length - 1) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i < 0 ? this.prev : input[i];
      const b = input[i + 1];
      this.out[this.filled++] = a + (b - a) * frac;
      if (this.filled === CHUNK_SAMPLES) {
        this.port.postMessage(this.out);
        this.out = new Float32Array(CHUNK_SAMPLES);
        this.filled = 0;
      }
      this.pos += this.step;
    }
    this.pos -= input.length;
    this.prev = input[input.length - 1];
    return true;
  }
}

registerProcessor('mic-resampler', MicResampler);
