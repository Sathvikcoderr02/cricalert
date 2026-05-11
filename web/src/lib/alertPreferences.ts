/** User-selectable alert kinds and sound presets (stored in localStorage). */

export const SOUND_PRESETS = ["ipl_sms", "chime", "bell", "buzz", "pop"] as const;
export type SoundPresetId = (typeof SOUND_PRESETS)[number];

export const ALERT_KINDS = [
  "team_50",
  "team_100",
  "team_150",
  "team_200",
  "wicket",
  "batter_50",
  "batter_100",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type AlertRule = {
  enabled: boolean;
  sound: SoundPresetId;
};

export type AlertPreferences = {
  /** Master switch: no sounds when false. */
  soundsEnabled: boolean;
  /** Only evaluate rules for matches that are live (started, not ended). */
  liveOnly: boolean;
  rules: Record<AlertKind, AlertRule>;
};

const STORAGE_KEY = "crikalert.alertPrefs.v2";
const LEGACY_STORAGE_KEY = "crikalert.alertPrefs.v1";

export const ALERT_LABELS: Record<AlertKind, string> = {
  team_50: "Team reaches 50 runs (inning)",
  team_100: "Team reaches 100 runs (inning)",
  team_150: "Team reaches 150 runs (inning)",
  team_200: "Team reaches 200 runs (inning)",
  wicket: "Wicket falls (wickets count up)",
  batter_50: "Batter reaches 50 runs",
  batter_100: "Batter reaches 100 runs",
};

function rule(enabled: boolean, sound: SoundPresetId): AlertRule {
  return { enabled, sound };
}

export function defaultAlertPreferences(): AlertPreferences {
  return {
    soundsEnabled: true,
    liveOnly: true,
    rules: {
      team_50: rule(true, "ipl_sms"),
      team_100: rule(true, "ipl_sms"),
      team_150: rule(true, "ipl_sms"),
      team_200: rule(true, "ipl_sms"),
      wicket: rule(true, "ipl_sms"),
      batter_50: rule(true, "ipl_sms"),
      batter_100: rule(true, "ipl_sms"),
    },
  };
}

function parseSound(s: unknown): SoundPresetId {
  return SOUND_PRESETS.includes(s as SoundPresetId)
    ? (s as SoundPresetId)
    : "chime";
}

function parseRule(raw: unknown, fallback: AlertRule): AlertRule {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    sound: parseSound(o.sound),
  };
}

function parseStoredPrefs(
  j: Record<string, unknown>,
  base: AlertPreferences,
): AlertPreferences {
  const rules = { ...base.rules };
  for (const k of ALERT_KINDS) {
    const key = `rule_${k}`;
    if (j[key] != null) {
      rules[k] = parseRule(j[key], base.rules[k]);
    }
  }
  return {
    soundsEnabled:
      typeof j.soundsEnabled === "boolean" ? j.soundsEnabled : base.soundsEnabled,
    liveOnly: typeof j.liveOnly === "boolean" ? j.liveOnly : base.liveOnly,
    rules,
  };
}

export function loadAlertPreferences(): AlertPreferences {
  const base = defaultAlertPreferences();
  if (typeof window === "undefined") return base;
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY);
    if (rawV2) {
      return parseStoredPrefs(JSON.parse(rawV2) as Record<string, unknown>, base);
    }
    const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const prefs = parseStoredPrefs(JSON.parse(rawV1) as Record<string, unknown>, base);
      saveAlertPreferences(prefs);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return prefs;
    }
  } catch {
    return base;
  }
  return base;
}

export function saveAlertPreferences(p: AlertPreferences): void {
  if (typeof window === "undefined") return;
  const out: Record<string, unknown> = {
    soundsEnabled: p.soundsEnabled,
    liveOnly: p.liveOnly,
  };
  for (const k of ALERT_KINDS) {
    out[`rule_${k}`] = p.rules[k];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
}
