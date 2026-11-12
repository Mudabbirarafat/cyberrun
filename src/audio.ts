import type { GameEvent } from "./game/types";

/**
 * Sound, synthesised rather than loaded.
 *
 * Five short effects as .wav or .mp3 would be a few hundred kilobytes of
 * binary in the repository, each with a licence to get right. These are a
 * handful of oscillators and an envelope, which costs nothing to download and
 * nothing to attribute.
 *
 * Browsers will not let audio start before a gesture, so the context is
 * created on the first key or tap and never before.
 */

let context: AudioContext | null = null;
let muted = false;

export function unlockAudio(): void {
  if (context) {
    if (context.state === "suspended") void context.resume();
    return;
  }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context = new Ctor();
  } catch {
    // No audio is a fine outcome; a crash is not.
    context = null;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  if (muted) stopSpeaking();
}

export function isMuted(): boolean {
  return muted;
}

/**
 * The crash line, read out by the browser.
 *
 * This is the one "voice" in the game and it is not a recording. Shipping a
 * meme clip would mean a few hundred kilobytes of someone else's audio with
 * a licence attached to it; `speechSynthesis` is already in the browser,
 * costs nothing to download and says whatever it is given.
 *
 * Everything here is defensive on purpose. The API is absent in some
 * browsers, present but voiceless in others, and throws in a few. None of
 * that is worth a broken game-over screen, so every failure is silence.
 */
export function speak(text: string): void {
  if (muted || !text) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;

    // A previous line still going is worse than no line: two voices over
    // each other is noise, and the one you want is the newer one.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Slightly fast and slightly low. The default cadence reads like a
    // railway announcement, which is funny once and tiresome after that.
    utterance.rate = 1.08;
    utterance.pitch = 0.92;
    utterance.volume = 0.9;
    synth.speak(utterance);
  } catch {
    // Silence is an acceptable outcome. A thrown error on the game-over
    // screen is not.
  }
}

export function stopSpeaking(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to do; it was not speaking.
  }
}

/** Whether this browser can say anything at all. */
export function canSpeak(): boolean {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  } catch {
    return false;
  }
}

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain: number;
}

function tone({ type, from, to, duration, gain }: Tone, delay = 0): void {
  if (!context || muted) return;
  const start = context.currentTime + delay;

  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  // A glide rather than a step: a bare square wave at a fixed pitch is the
  // sound of a 1980s alarm clock.
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(envelope).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(duration: number, gain: number): void {
  if (!context || muted) return;
  const frames = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Fading the noise as it is written, so it reads as an impact rather
    // than a burst of static.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;

  const envelope = context.createGain();
  envelope.gain.value = gain;

  source.connect(filter).connect(envelope).connect(context.destination);
  source.start();
}

export function playEvent(event: GameEvent): void {
  switch (event) {
    case "jump":
      tone({ type: "triangle", from: 320, to: 660, duration: 0.16, gain: 0.16 });
      return;
    case "slide":
      tone({ type: "sawtooth", from: 420, to: 150, duration: 0.2, gain: 0.1 });
      return;
    case "lane":
      tone({ type: "square", from: 540, to: 620, duration: 0.05, gain: 0.05 });
      return;
    case "coin":
      // Two notes a fifth apart: the sound of picking something up.
      tone({ type: "square", from: 880, to: 880, duration: 0.07, gain: 0.1 });
      tone({ type: "square", from: 1320, to: 1320, duration: 0.09, gain: 0.09 }, 0.06);
      return;
    case "power":
      tone({ type: "triangle", from: 520, to: 1040, duration: 0.14, gain: 0.14 });
      tone({ type: "triangle", from: 780, to: 1560, duration: 0.18, gain: 0.12 }, 0.1);
      return;
    case "shielded":
      tone({ type: "sawtooth", from: 900, to: 300, duration: 0.25, gain: 0.14 });
      return;
    case "nearmiss":
      // A breath past the ear: short, airy and quiet enough that a run full
      // of them does not become a drum solo.
      noise(0.13, 0.07);
      tone({ type: "sine", from: 1500, to: 2400, duration: 0.1, gain: 0.05 });
      return;
    case "combostep":
      // Up a fourth each time it fires, so stacking reads as climbing.
      tone({ type: "triangle", from: 660, to: 990, duration: 0.12, gain: 0.11 });
      tone({ type: "sine", from: 1320, to: 1980, duration: 0.14, gain: 0.07 }, 0.05);
      return;
    case "combobreak":
      // Down, and under the coins: losing the chain should be noticed, not
      // announced. A crash has its own noise and does not also play this.
      tone({ type: "sine", from: 480, to: 180, duration: 0.22, gain: 0.07 });
      return;
    case "crash":
      noise(0.45, 0.32);
      tone({ type: "sawtooth", from: 260, to: 50, duration: 0.5, gain: 0.2 });
      // Four descending notes with a slide on the last - the shape of the
      // trombone everyone knows, built from oscillators rather than lifted
      // from a clip. It sits under the spoken line, which starts later.
      tone({ type: "triangle", from: 392, to: 392, duration: 0.17, gain: 0.12 }, 0.18);
      tone({ type: "triangle", from: 349, to: 349, duration: 0.17, gain: 0.12 }, 0.36);
      tone({ type: "triangle", from: 330, to: 330, duration: 0.17, gain: 0.12 }, 0.54);
      tone({ type: "triangle", from: 311, to: 196, duration: 0.5, gain: 0.14 }, 0.72);
      return;
  }
}

export function playEvents(events: readonly GameEvent[]): void {
  // A frame can hold several of the same event - a row of coins at speed.
  // Playing each one stacks into a click, so repeats collapse.
  const seen = new Set<GameEvent>();
  for (const event of events) {
    if (seen.has(event)) continue;
    seen.add(event);
    playEvent(event);
  }
}
