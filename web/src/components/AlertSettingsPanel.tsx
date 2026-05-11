"use client";

import { useCallback, useState } from "react";
import {
  ALERT_KINDS,
  ALERT_LABELS,
  SOUND_PRESETS,
  type AlertKind,
  type AlertPreferences,
  type SoundPresetId,
} from "@/lib/alertPreferences";
import { playAlertSound, resumeAudioContext } from "@/lib/playAlertSound";

export function AlertSettingsPanel({
  value,
  onChange,
}: {
  value: AlertPreferences;
  onChange: (next: AlertPreferences) => void;
}) {
  const [open, setOpen] = useState(false);

  const setRule = useCallback(
    (kind: AlertKind, patch: Partial<AlertPreferences["rules"][AlertKind]>) => {
      onChange({
        ...value,
        rules: {
          ...value.rules,
          [kind]: { ...value.rules[kind], ...patch },
        },
      });
    },
    [onChange, value],
  );

  const testPreset = useCallback(async (preset: SoundPresetId) => {
    await resumeAudioContext();
    playAlertSound(preset);
  }, []);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-lg shadow-black/30 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] sm:px-5"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400/90">
            Score alerts
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            Sounds when scores change on refresh
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Alerts compare each refresh to the last one (default 5 minutes, or
            Refresh now). Team totals use the scorecard when the API omits live
            scores. Tap Play once if the browser blocks audio until a gesture.
          </p>
        </div>
        <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-white/10 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="size-4 rounded border-white/20 bg-slate-900 accent-emerald-500"
                checked={value.soundsEnabled}
                onChange={(e) =>
                  onChange({ ...value, soundsEnabled: e.target.checked })
                }
              />
              Enable sounds
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="size-4 rounded border-white/20 bg-slate-900 accent-emerald-500"
                checked={value.liveOnly}
                onChange={(e) => onChange({ ...value, liveOnly: e.target.checked })}
              />
              Live matches only
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/90 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">On</th>
                  <th className="px-3 py-2.5">Event</th>
                  <th className="px-3 py-2.5">Sound</th>
                  <th className="px-3 py-2.5">Test</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {ALERT_KINDS.map((kind) => {
                  const rule = value.rules[kind];
                  return (
                    <tr
                      key={kind}
                      className="border-b border-white/[0.06] last:border-0 odd:bg-black/20"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-white/20 bg-slate-900 accent-emerald-500"
                          checked={rule.enabled}
                          onChange={(e) =>
                            setRule(kind, { enabled: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-200">
                        {ALERT_LABELS[kind]}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className="w-full max-w-[140px] rounded-lg border border-white/15 bg-slate-950 px-2 py-1.5 text-xs text-white"
                          value={rule.sound}
                          onChange={(e) =>
                            setRule(kind, {
                              sound: e.target.value as SoundPresetId,
                            })
                          }
                        >
                          {SOUND_PRESETS.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:border-emerald-500/40 hover:bg-emerald-950/40"
                          onClick={() => void testPreset(rule.sound)}
                        >
                          Play
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
