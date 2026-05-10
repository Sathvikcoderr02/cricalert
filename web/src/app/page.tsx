"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertSettingsPanel } from "@/components/AlertSettingsPanel";
import { CricketBackdrop } from "@/components/CricketBackdrop";
import { MatchScorecardPanel } from "@/components/MatchScorecardPanel";
import {
  defaultAlertPreferences,
  loadAlertPreferences,
  saveAlertPreferences,
  type AlertPreferences,
} from "@/lib/alertPreferences";
import { diffMatchScoreSnapshots } from "@/lib/detectScoreAlerts";
import type { CurrentMatch, SquadTeam } from "@/lib/cricapi";
import { buildMatchScoreSnapshot } from "@/lib/matchSnapshot";
import type { ParsedScorecard } from "@/lib/matchScorecard";
import { playAlertSound } from "@/lib/playAlertSound";

type MatchRow = CurrentMatch & {
  liveScorecard: ParsedScorecard | null;
  scorecardReason: string | null;
  squad: SquadTeam[] | null;
};

type ApiOk = {
  updatedAt: string;
  matches: MatchRow[];
  apiInfo: unknown;
};

type ApiErr = { error: string };

/** Auto-refresh interval (scores update on this cadence). */
const POLL_MS = 5 * 60 * 1000;

function formatOvers(o: number): string {
  const whole = Math.floor(o);
  const balls = Math.round((o - whole) * 10);
  if (balls >= 6) return `${whole + 1}.0`;
  return `${whole}.${balls}`;
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function scoreFallbackFromLiveScorecard(
  liveScorecard: ParsedScorecard | null,
): CurrentMatch["score"] {
  if (!liveScorecard) return [];
  return liveScorecard.innings.map((inn) => {
    const runs = inn.batting.reduce((sum, row) => sum + row.r, 0);
    const wickets = inn.batting.reduce(
      (sum, row) => sum + (row.dismissal.trim() ? 1 : 0),
      0,
    );
    return {
      r: runs,
      w: wickets,
      o: 0,
      inning: inn.label,
    };
  });
}

function MatchStatusPill({
  ended,
  started,
}: {
  ended: boolean;
  started: boolean;
}) {
  if (ended) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        Final
      </span>
    );
  }
  if (started) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
        <span className="live-dot size-1.5 shrink-0 rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-950/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
      Upcoming
    </span>
  );
}

export default function Home() {
  const [data, setData] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [squadOpen, setSquadOpen] = useState<Record<string, boolean>>({});
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [remainSec, setRemainSec] = useState(0);
  const [alertPrefs, setAlertPrefs] = useState<AlertPreferences>(() =>
    defaultAlertPreferences(),
  );

  const prevSnapsRef = useRef(new Map<string, ReturnType<typeof buildMatchScoreSnapshot>>());
  const skipNextDiffRef = useRef(true);
  const alertSaveSkipFirst = useRef(false);

  const scheduleNextRefresh = useCallback(() => {
    setNextRefreshAt(Date.now() + POLL_MS);
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/ipl", { cache: "no-store" });
      const body = (await res.json()) as ApiOk & ApiErr;
      if (!res.ok) {
        setErr("error" in body ? body.error : res.statusText);
        setData(null);
        setNextRefreshAt(null);
        return;
      }
      setData(body as ApiOk);
      scheduleNextRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
      setData(null);
      setNextRefreshAt(null);
    } finally {
      setLoading(false);
    }
  }, [scheduleNextRefresh]);

  useEffect(() => {
    const run = () => queueMicrotask(() => void load());
    run();
    const id = setInterval(run, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      setAlertPrefs(loadAlertPreferences());
    });
  }, []);

  useEffect(() => {
    if (!alertSaveSkipFirst.current) {
      alertSaveSkipFirst.current = true;
      return;
    }
    saveAlertPreferences(alertPrefs);
  }, [alertPrefs]);

  useEffect(() => {
    if (!data?.matches) return;
    const nextMap = new Map(
      data.matches.map((m) => [m.id, buildMatchScoreSnapshot(m)] as const),
    );
    if (skipNextDiffRef.current) {
      skipNextDiffRef.current = false;
      prevSnapsRef.current = nextMap;
      return;
    }
    if (alertPrefs.soundsEnabled) {
      for (const m of data.matches) {
        const next = nextMap.get(m.id);
        if (!next) continue;
        if (alertPrefs.liveOnly && !next.live) continue;
        const prev = prevSnapsRef.current.get(m.id);
        if (!prev) continue;
        const alerts = diffMatchScoreSnapshots(prev, next, m.name);
        for (const a of alerts) {
          const rule = alertPrefs.rules[a.kind];
          if (rule?.enabled) {
            playAlertSound(rule.sound);
          }
        }
      }
    }
    prevSnapsRef.current = nextMap;
  }, [data, alertPrefs]);

  useEffect(() => {
    if (!nextRefreshAt) return;
    const tick = () => {
      setRemainSec(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRefreshAt]);

  const showSkeleton = loading && !data;

  return (
    <CricketBackdrop>
      <div className="min-h-full pb-16 text-slate-100">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/65 shadow-lg shadow-black/30 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400/95">
                Crikalert
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                IPL scores
              </h1>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-400">
                Scorecard via CricAPI. Data refreshes automatically every{" "}
                <span className="font-semibold text-slate-300">5 minutes</span>
                {nextRefreshAt && remainSec > 0 ? (
                  <>
                    {" "}
                    · next in{" "}
                    <span className="tabular-nums text-emerald-300/90">
                      {formatCountdown(remainSec)}
                    </span>
                  </>
                ) : null}
                . Use refresh for an immediate pull.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end md:flex-row md:items-center">
              {data?.updatedAt ? (
                <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-right text-xs text-slate-400 backdrop-blur-sm">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                    Last synced
                  </span>
                  <span className="tabular-nums text-slate-200">
                    {new Date(data.updatedAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400/35 transition hover:from-emerald-400 hover:to-emerald-600 disabled:opacity-45"
                disabled={loading}
              >
                {loading ? "Updating…" : "Refresh now"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
          <AlertSettingsPanel value={alertPrefs} onChange={setAlertPrefs} />

          {showSkeleton ? (
            <div
              className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-6 backdrop-blur-md"
              aria-hidden
            >
              <div className="skeleton-shimmer h-4 w-40 rounded-md" />
              <div className="skeleton-shimmer h-28 w-full rounded-xl" />
              <div className="skeleton-shimmer h-40 w-full rounded-xl" />
            </div>
          ) : null}

          {err ? (
            <div
              className="rounded-2xl border border-red-500/35 bg-red-950/55 px-5 py-4 text-sm text-red-100 shadow-xl shadow-red-950/30 backdrop-blur-md"
              role="alert"
            >
              {err}
            </div>
          ) : null}

          {!err && !loading && data && data.matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 px-6 py-10 text-center shadow-xl shadow-black/25 backdrop-blur-md">
              <p className="text-lg font-semibold text-white">No IPL matches right now</p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                Nothing in the CricAPI &ldquo;current matches&rdquo; feed matches IPL
                titles. When IPL is listed, fixtures appear here with the same
                5-minute refresh.
              </p>
            </div>
          ) : null}

          <ul className="mt-2 flex flex-col gap-8">
            {data?.matches.map((m) => {
              const inningsScore =
                m.score && m.score.length > 0
                  ? m.score
                  : scoreFallbackFromLiveScorecard(m.liveScorecard);
              return (
              <li key={m.id}>
                <article className="overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-slate-900/70 to-slate-950/80 shadow-2xl shadow-black/50 ring-1 ring-white/[0.04] backdrop-blur-md">
                  <div className="relative border-b border-white/10 px-5 py-5 sm:px-6">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <MatchStatusPill
                        ended={m.matchEnded}
                        started={m.matchStarted}
                      />
                    </div>
                    <h2 className="mt-3 text-lg font-bold leading-snug text-white sm:text-xl">
                      {m.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">{m.venue}</p>
                    <p className="mt-3 rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-sm font-medium text-slate-200">
                      {m.status}
                    </p>
                  </div>

                  {inningsScore && inningsScore.length > 0 ? (
                    <div className="grid gap-3 border-b border-white/10 px-5 py-5 sm:grid-cols-2 sm:px-6">
                      {inningsScore.map((inn, i) => (
                        <div
                          key={`${m.id}-inn-${i}`}
                          className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 px-4 py-4 shadow-inner shadow-black/30"
                        >
                          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400/80 to-emerald-600/30" />
                          <p className="pl-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {inn.inning}
                          </p>
                          <p className="mt-2 pl-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                            {inn.r}
                            <span className="text-slate-500">/</span>
                            {inn.w}
                            {inn.o > 0 ? (
                              <span className="ml-2 text-base font-semibold text-slate-400">
                                ({formatOvers(inn.o)} ov)
                              </span>
                            ) : null}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="px-5 py-5 sm:px-6">
                    {m.liveScorecard ? (
                      <MatchScorecardPanel parsed={m.liveScorecard} />
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-200/95">
                          {m.scorecardReason ??
                            "Detailed scorecard is not available for this fixture."}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-500">
                          CricAPI only returns full scorecards for some matches. The
                          squad list below is the full squad, not the playing XI.
                        </p>
                        {m.squad && m.squad.length > 0 ? (
                          <>
                            <button
                              type="button"
                              className="text-sm font-semibold text-emerald-400 underline-offset-2 hover:text-emerald-300 hover:underline"
                              onClick={() =>
                                setSquadOpen((prev) => ({
                                  ...prev,
                                  [m.id]: !prev[m.id],
                                }))
                              }
                            >
                              {squadOpen[m.id] ? "Hide full squads" : "Show full squads"}
                            </button>
                            {squadOpen[m.id] ? (
                              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                                {m.squad.map((t) => (
                                  <div
                                    key={t.teamName}
                                    className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                                  >
                                    <h3 className="text-sm font-bold text-white">
                                      {t.teamName}{" "}
                                      <span className="font-normal text-slate-500">
                                        ({t.shortname})
                                      </span>
                                    </h3>
                                    <ul className="mt-3 max-h-64 space-y-0 overflow-y-auto text-sm text-slate-300">
                                      {t.players.map((p) => (
                                        <li
                                          key={p.id}
                                          className="flex justify-between gap-2 border-b border-white/5 py-2 last:border-0"
                                        >
                                          <span>{p.name}</span>
                                          <span className="shrink-0 text-xs text-slate-500">
                                            {p.role !== "--" ? p.role : ""}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : m.hasSquad === false ? (
                          <p className="text-sm text-slate-500">
                            No squad data from the API for this match.
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">
                            Squad could not be loaded.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              </li>
              );
            })}
          </ul>

          <p className="mt-14 text-center text-[10px] text-slate-500/90">
            Stadium background:{" "}
            <a
              className="underline decoration-slate-600 underline-offset-2 hover:text-slate-400"
              href="https://unsplash.com/photos/1624526267942-ab0ff8a3e972?utm_source=crikalert&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
            >
              Unsplash
            </a>{" "}
            (Unsplash License)
          </p>
        </main>
      </div>
    </CricketBackdrop>
  );
}
