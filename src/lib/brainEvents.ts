// Simple event bus for brain reactivity
type BrainEvent = "wave" | "speakStart" | "speakEnd";
const listeners: Record<BrainEvent, Set<() => void>> = {
  wave: new Set(),
  speakStart: new Set(),
  speakEnd: new Set(),
};

export function onBrainEvent(ev: BrainEvent, cb: () => void) {
  listeners[ev].add(cb);
  return () => listeners[ev].delete(cb);
}

export function emitBrainEvent(ev: BrainEvent) {
  listeners[ev].forEach((fn) => fn());
}

// Audio reactivity: shared intensity 0..1 driven by speech
let _speakingIntensity = 0;
let _decayRaf: number | null = null;

export function getSpeakingIntensity() {
  return _speakingIntensity;
}

// Mode burst channel (carries color payload)
type BurstCb = (color: string) => void;
const burstListeners: Set<BurstCb> = new Set();
export function onModeBurst(cb: BurstCb) {
  burstListeners.add(cb);
  return () => burstListeners.delete(cb);
}
export function emitModeBurst(color: string) {
  burstListeners.forEach((fn) => fn(color));
}

export function setSpeakingActive(active: boolean) {
  if (active) {
    _speakingIntensity = 1;
    emitBrainEvent("speakStart");
    if (_decayRaf) cancelAnimationFrame(_decayRaf);
    const tick = () => {
      // Oscillate while speaking to simulate audio envelope
      _speakingIntensity = 0.55 + Math.sin(performance.now() * 0.012) * 0.35 + Math.random() * 0.1;
      _decayRaf = requestAnimationFrame(tick);
    };
    tick();
  } else {
    if (_decayRaf) cancelAnimationFrame(_decayRaf);
    _decayRaf = null;
    _speakingIntensity = 0;
    emitBrainEvent("speakEnd");
  }
}
