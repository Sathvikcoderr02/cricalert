import type { ParsedScorecard } from "@/lib/matchScorecard";

/** Same totals as the score strip when CricAPI omits `match.score`. */
export function scoreFallbackFromLiveScorecard(
  liveScorecard: ParsedScorecard | null,
): { r: number; w: number; o: number; inning: string }[] {
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
  const fromApi = (m.score ?? []).map((s) => ({ r: s.r, w: s.w }));
  const fromCard = scoreFallbackFromLiveScorecard(m.liveScorecard).map(({ r, w }) => ({
    r,
    w,
  }));
  const score = fromApi.length > 0 ? fromApi : fromCard;
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
