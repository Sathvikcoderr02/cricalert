import type { ParsedScorecard } from "@/lib/matchScorecard";

/** Compact state for diffing score alerts between polls. */
export type MatchScoreSnapshot = {
  matchId: string;
  /** Started and not ended — alerts can be gated on this. */
  live: boolean;
  score: { r: number; w: number }[];
  /** Per-innings map: stable key → runs and dismissed flag. */
  battersByInn: Array<Record<string, { r: number; dismissed: boolean }>>;
};

function batterKey(playerId: string, playerName: string): string {
  if (playerId) return `id:${playerId}`;
  return `n:${playerName.toLowerCase().trim()}`;
}

export function buildMatchScoreSnapshot(m: {
  id: string;
  matchStarted: boolean;
  matchEnded: boolean;
  score?: { r: number; w: number }[];
  liveScorecard: ParsedScorecard | null;
}): MatchScoreSnapshot {
  const score = (m.score ?? []).map((s) => ({ r: s.r, w: s.w }));
  const innings = m.liveScorecard?.innings ?? [];
  const battersByInn = innings.map((inn) => {
    const rec: Record<string, { r: number; dismissed: boolean }> = {};
    for (const row of inn.batting) {
      const key = batterKey(row.playerId, row.playerName);
      rec[key] = {
        r: row.r,
        dismissed: row.dismissal.trim().length > 0,
      };
    }
    return rec;
  });
  return {
    matchId: m.id,
    live: m.matchStarted && !m.matchEnded,
    score,
    battersByInn,
  };
}
