import type { AlertKind } from "@/lib/alertPreferences";
import type { MatchScoreSnapshot } from "@/lib/matchSnapshot";

export type ScoreAlert = {
  kind: AlertKind;
  matchName: string;
  detail?: string;
};

const RUN_MILESTONES: { threshold: number; kind: AlertKind }[] = [
  { threshold: 50, kind: "team_50" },
  { threshold: 100, kind: "team_100" },
  { threshold: 150, kind: "team_150" },
  { threshold: 200, kind: "team_200" },
];

function crossedMilestones(prevR: number, nextR: number): AlertKind[] {
  const out: AlertKind[] = [];
  for (const { threshold, kind } of RUN_MILESTONES) {
    if (prevR < threshold && nextR >= threshold) out.push(kind);
  }
  return out;
}

/**
 * Compare two snapshots for the same match. Caller must ensure same `matchId`.
 * Does not emit on first-ever snapshot (caller skips when `prev` is missing).
 */
export function diffMatchScoreSnapshots(
  prev: MatchScoreSnapshot,
  next: MatchScoreSnapshot,
  matchName: string,
): ScoreAlert[] {
  const alerts: ScoreAlert[] = [];

  const nInn = Math.max(prev.score.length, next.score.length);
  for (let i = 0; i < nInn; i++) {
    const pi = prev.score[i];
    const ni = next.score[i];
    if (!ni) continue;
    // Avoid treating a newly appeared innings row as crossing from 0 runs.
    if (pi === undefined) continue;

    const pr = pi.r;
    const pw = pi.w;
    const nr = ni.r;
    const nw = ni.w;

    for (const kind of crossedMilestones(pr, nr)) {
      alerts.push({
        kind,
        matchName,
        detail: `Innings ${i + 1}`,
      });
    }

    if (nw > pw) {
      alerts.push({
        kind: "wicket",
        matchName,
        detail: nw - pw === 1 ? "1 wicket" : `${nw - pw} wickets`,
      });
    }
  }

  const nBatInn = Math.max(prev.battersByInn.length, next.battersByInn.length);
  for (let inn = 0; inn < nBatInn; inn++) {
    const pb = prev.battersByInn[inn] ?? {};
    const nb = next.battersByInn[inn] ?? {};
    for (const [key, nv] of Object.entries(nb)) {
      const pv = pb[key];
      if (!pv) continue;
      if (pv.r < 50 && nv.r >= 50) {
        alerts.push({ kind: "batter_50", matchName, detail: `Inn ${inn + 1}` });
      }
      if (pv.r < 100 && nv.r >= 100) {
        alerts.push({ kind: "batter_100", matchName, detail: `Inn ${inn + 1}` });
      }
    }
  }

  return alerts;
}
