import type { SoundPresetId } from "@/lib/alertPreferences";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

/** Call after a user gesture so playback is allowed (Safari / Chrome policy). */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getCtx();
  if (ctx?.state === "suspended") {
    await ctx.resume();
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gain = 0.12,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.linearRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/**
 * Plays a short preset tone. Safe to call repeatedly; drops if AudioContext unavailable.
 */
export function playAlertSound(preset: SoundPresetId): void {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  switch (preset) {
    case "chime":
      beep(ctx, 880, t0, 0.12, 0.1);
      beep(ctx, 1174.66, t0 + 0.1, 0.14, 0.09);
      break;
    case "bell":
      beep(ctx, 660, t0, 0.35, 0.14);
      beep(ctx, 990, t0 + 0.08, 0.28, 0.08);
      break;
    case "buzz":
      beep(ctx, 220, t0, 0.08, 0.14, "square");
      beep(ctx, 185, t0 + 0.09, 0.1, 0.12, "square");
      break;
    case "pop":
    default:
      beep(ctx, 520, t0, 0.04, 0.16);
      beep(ctx, 780, t0 + 0.045, 0.05, 0.1);
      break;
  }
}
