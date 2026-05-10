"use client";

import { useMemo } from "react";
import type {
  BattingRow,
  BowlingRow,
  InningScorecard,
  ParsedScorecard,
  TeamPlaying,
} from "@/lib/matchScorecard";

function fmtSr(sr: number): string {
  if (!sr) return "—";
  return sr >= 100 ? sr.toFixed(0) : sr.toFixed(2);
}

function fmtEcon(e: number): string {
  if (!e) return "—";
  return e.toFixed(2);
}

function fmtOvers(o: number): string {
  if (o === 0) return "0";
  const whole = Math.floor(o);
  const frac = Math.round((o - whole) * 10);
  if (frac >= 6) return `${whole + 1}.0`;
  return frac ? `${whole}.${frac}` : `${whole}.0`;
}

type Index = {
  batById: Map<string, BattingRow>;
  batByName: Map<string, BattingRow>;
  bowlById: Map<string, BowlingRow>;
  bowlByName: Map<string, BowlingRow>;
};

function indexInnings(innings: InningScorecard[]): Index {
  const batById = new Map<string, BattingRow>();
  const batByName = new Map<string, BattingRow>();
  const bowlById = new Map<string, BowlingRow>();
  const bowlByName = new Map<string, BowlingRow>();
  for (const inn of innings) {
    for (const b of inn.batting) {
      if (b.playerId) batById.set(b.playerId, b);
      batByName.set(b.playerName.toLowerCase(), b);
    }
    for (const w of inn.bowling) {
      if (w.playerId) bowlById.set(w.playerId, w);
      bowlByName.set(w.playerName.toLowerCase(), w);
    }
  }
  return { batById, batByName, bowlById, bowlByName };
}

function batForPlayer(p: { id: string; name: string }, ix: Index): BattingRow | null {
  if (p.id && ix.batById.has(p.id)) return ix.batById.get(p.id)!;
  return ix.batByName.get(p.name.toLowerCase()) ?? null;
}

function bowlForPlayer(p: { id: string; name: string }, ix: Index): BowlingRow | null {
  if (p.id && ix.bowlById.has(p.id)) return ix.bowlById.get(p.id)!;
  return ix.bowlByName.get(p.name.toLowerCase()) ?? null;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
      <span className="h-px w-6 bg-gradient-to-r from-emerald-500/80 to-transparent" />
      {children}
    </h3>
  );
}

export function MatchScorecardPanel({
  parsed,
}: {
  parsed: ParsedScorecard;
}) {
  const ix = useMemo(() => indexInnings(parsed.innings), [parsed.innings]);

  return (
    <div className="space-y-10">
      {parsed.teams && parsed.teams.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle>Playing XI</SectionTitle>
          <p className="text-xs leading-relaxed text-slate-500">
            From the scorecard &ldquo;team&rdquo; payload where the API provides it,
            with figures matched from the scorecard.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {parsed.teams.map((t) => (
              <PlayingElevenTable key={t.teamName} team={t} ix={ix} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <SectionTitle>Scorecard</SectionTitle>
        {parsed.innings.map((inn, i) => (
          <InningBlock key={`${inn.label}-${i}`} inn={inn} />
        ))}
      </section>
    </div>
  );
}

function PlayingElevenTable({ team, ix }: { team: TeamPlaying; ix: Index }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/12 bg-slate-950/55 shadow-lg shadow-black/30">
      <p className="border-b border-white/10 bg-emerald-950/25 px-4 py-2.5 text-xs font-bold text-emerald-200/95">
        {team.teamName}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs text-slate-300">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/90 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Player</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">Runs</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">Balls</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">SR</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">O</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">M</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">R</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">W</th>
              <th className="px-2 py-2.5 font-semibold tabular-nums">Econ</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p, idx) => {
              const b = batForPlayer(p, ix);
              const w = bowlForPlayer(p, ix);
              return (
                <tr
                  key={p.id + p.name}
                  className={
                    idx % 2 === 0
                      ? "border-b border-white/[0.06] bg-black/15"
                      : "border-b border-white/[0.06] bg-transparent"
                  }
                >
                  <td className="px-3 py-2.5 font-medium text-slate-100">{p.name}</td>
                  <td className="px-2 py-2.5 tabular-nums">{b ? b.r : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{b ? b.b : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{b ? fmtSr(b.sr) : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{w ? fmtOvers(w.o) : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{w ? w.m : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{w ? w.r : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{w ? w.w : "—"}</td>
                  <td className="px-2 py-2.5 tabular-nums">{w ? fmtEcon(w.econ) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InningBlock({ inn }: { inn: InningScorecard }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/12 bg-slate-950/50 shadow-md shadow-black/25">
      <p className="border-b border-white/10 bg-slate-900/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {inn.label}
      </p>
      <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-white/10">
        <div className="p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">
            Batting
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[280px] text-left text-xs">
              <thead>
                <tr className="bg-slate-900/95 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-semibold">Batter</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">R</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">B</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">4s</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">6s</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">SR</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {inn.batting.map((row, i) => (
                  <tr
                    key={`${row.playerName}-${i}`}
                    className={
                      i % 2 === 0
                        ? "border-t border-white/[0.06] bg-black/20"
                        : "border-t border-white/[0.06]"
                    }
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-100">{row.playerName}</span>
                      {row.dismissal ? (
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                          {row.dismissal}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums font-medium text-white">
                      {row.r}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{row.b}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.fours}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.sixes}</td>
                    <td className="px-2 py-2.5 tabular-nums text-slate-400">
                      {fmtSr(row.sr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border-t border-white/10 p-4 lg:border-t-0">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-sky-500/80">
            Bowling
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[260px] text-left text-xs">
              <thead>
                <tr className="bg-slate-900/95 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-semibold">Bowler</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">O</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">M</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">R</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">W</th>
                  <th className="px-2 py-2 font-semibold tabular-nums">Econ</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {inn.bowling.map((row, i) => (
                  <tr
                    key={`${row.playerName}-${i}`}
                    className={
                      i % 2 === 0
                        ? "border-t border-white/[0.06] bg-black/20"
                        : "border-t border-white/[0.06]"
                    }
                  >
                    <td className="px-3 py-2.5 font-semibold text-slate-100">
                      {row.playerName}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{fmtOvers(row.o)}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.m}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row.r}</td>
                    <td className="px-2 py-2.5 tabular-nums font-medium text-white">
                      {row.w}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-slate-400">
                      {fmtEcon(row.econ)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
