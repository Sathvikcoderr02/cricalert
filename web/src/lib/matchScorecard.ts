/** Normalized shapes for CricAPI `match_scorecard` (v1) responses. */

export type BattingRow = {
  playerId: string;
  playerName: string;
  dismissal: string;
  r: number;
  b: number;
  fours: number;
  sixes: number;
  sr: number;
};

export type BowlingRow = {
  playerId: string;
  playerName: string;
  o: number;
  m: number;
  r: number;
  w: number;
  econ: number;
};

export type InningScorecard = {
  label: string;
  batting: BattingRow[];
  bowling: BowlingRow[];
};

export type TeamPlaying = {
  teamName: string;
  players: { id: string; name: string }[];
};

export type ParsedScorecard = {
  innings: InningScorecard[];
  /** When the API includes fantasy `team` blocks — active / playing side (not full squad). */
  teams: TeamPlaying[] | null;
};

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function playerId(p: Record<string, unknown> | undefined): string {
  if (!p) return "";
  const id = p.id ?? p.pid;
  return id != null ? String(id) : "";
}

function playerName(p: Record<string, unknown> | undefined): string {
  if (!p) return "";
  const n = p.name ?? p.batsman ?? p.bowler;
  return n != null ? String(n) : "";
}

function parseBattingRow(row: unknown): BattingRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const batsmanRaw = r.batsman;
  let id = "";
  let name = "";
  if (typeof batsmanRaw === "object" && batsmanRaw) {
    const batsman = batsmanRaw as Record<string, unknown>;
    id = playerId(batsman);
    name = playerName(batsman);
  } else if (typeof batsmanRaw === "string") {
    name = batsmanRaw;
  }
  if (!name) return null;
  const dismissal =
    typeof r["dismissal-text"] === "string"
      ? r["dismissal-text"]
      : typeof r.dismissalText === "string"
        ? r.dismissalText
        : typeof r["dismissal-info"] === "string"
          ? r["dismissal-info"]
          : "";
  return {
    playerId: id,
    playerName: name,
    dismissal,
    r: num(r.r ?? r.R),
    b: num(r.b ?? r.B),
    fours: num(r["4s"] ?? r.fours),
    sixes: num(r["6s"] ?? r.sixes),
    sr: num(r.sr ?? r.SR),
  };
}

function parseBowlingRow(row: unknown): BowlingRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const bowlerRaw = r.bowler;
  let id = "";
  let name = "";
  if (typeof bowlerRaw === "object" && bowlerRaw) {
    const bowler = bowlerRaw as Record<string, unknown>;
    id = playerId(bowler);
    name = playerName(bowler);
  } else if (typeof bowlerRaw === "string") {
    name = bowlerRaw;
  }
  if (!name) return null;
  return {
    playerId: id,
    playerName: name,
    o: num(r.o ?? r.O),
    m: num(r.m ?? r.M),
    r: num(r.r ?? r.R),
    w: num(r.w ?? r.W),
    econ: num(r.econ ?? r.Econ),
  };
}

function parseBattingList(raw: unknown): BattingRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BattingRow[] = [];
  for (const row of raw) {
    const parsed = parseBattingRow(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseBowlingList(raw: unknown): BowlingRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BowlingRow[] = [];
  for (const row of raw) {
    const parsed = parseBowlingRow(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Legacy fantasy layout: batting[i].scores[0] = rows */
function parseLegacyInnings(data: Record<string, unknown>): InningScorecard[] {
  const batting = data.batting;
  const bowling = data.bowling;
  if (!Array.isArray(batting) || !Array.isArray(bowling)) return [];
  const n = Math.max(batting.length, bowling.length);
  const innings: InningScorecard[] = [];
  for (let i = 0; i < n; i++) {
    const bInn = batting[i] as Record<string, unknown> | undefined;
    const bowlInn = bowling[i] as Record<string, unknown> | undefined;
    const title =
      (typeof bInn?.title === "string" && bInn.title) ||
      (typeof bowlInn?.title === "string" && bowlInn.title) ||
      `Innings ${i + 1}`;
    const bScores = bInn?.scores;
    const bRowArr =
      Array.isArray(bScores) && bScores.length > 0 ? bScores[0] : undefined;
    const bRows = Array.isArray(bRowArr) ? bRowArr : [];
    const bowlScores = bowlInn?.scores;
    const bowlRowArr =
      Array.isArray(bowlScores) && bowlScores.length > 0
        ? bowlScores[0]
        : undefined;
    const bowlRows = Array.isArray(bowlRowArr) ? bowlRowArr : [];
    const battingNorm = bRows.map((row) => {
      const o = row as Record<string, unknown>;
      const pid = String(o.pid ?? o.id ?? "");
      const name = String(o.batsman ?? o.name ?? "");
      return {
        playerId: pid,
        playerName: name,
        dismissal: String(o["dismissal-info"] ?? o.dismissal ?? ""),
        r: num(o.R ?? o.r),
        b: num(o.B ?? o.b),
        fours: num(o["4s"]),
        sixes: num(o["6s"]),
        sr: num(o.SR ?? o.sr),
      } satisfies BattingRow;
    }).filter((x) => x.playerName);
    const bowlingNorm = bowlRows.map((row) => {
      const o = row as Record<string, unknown>;
      const pid = String(o.pid ?? o.id ?? "");
      const name = String(o.bowler ?? o.name ?? "");
      return {
        playerId: pid,
        playerName: name,
        o: num(o.O ?? o.o),
        m: num(o.M ?? o.m),
        r: num(o.R ?? o.r),
        w: num(o.W ?? o.w),
        econ: num(o.Econ ?? o.econ),
      } satisfies BowlingRow;
    }).filter((x) => x.playerName);
    innings.push({
      label: title,
      batting: battingNorm,
      bowling: bowlingNorm,
    });
  }
  return innings;
}

function parseTeamsBlock(raw: unknown): TeamPlaying[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const teams: TeamPlaying[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const teamName = String(o.name ?? o.teamName ?? "");
    const playersRaw = o.players;
    if (!Array.isArray(playersRaw)) continue;
    const players = playersRaw
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const pr = p as Record<string, unknown>;
        const id = String(pr.id ?? pr.pid ?? "");
        const name = String(pr.name ?? "");
        if (!name) return null;
        return { id, name };
      })
      .filter(Boolean) as { id: string; name: string }[];
    if (teamName || players.length) {
      teams.push({ teamName: teamName || "Team", players });
    }
  }
  return teams.length ? teams : null;
}

export function parseMatchScorecardPayload(body: {
  data?: unknown;
}): ParsedScorecard | null {
  const data = body.data;
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const teams = parseTeamsBlock(d.team);

  if (Array.isArray(d.scorecard) && d.scorecard.length > 0) {
    const innings: InningScorecard[] = [];
    for (let i = 0; i < d.scorecard.length; i++) {
      const inn = d.scorecard[i] as Record<string, unknown>;
      const label =
        (typeof inn.title === "string" && inn.title) ||
        (typeof inn.name === "string" && inn.name) ||
        (typeof inn.inning === "string" && inn.inning) ||
        `Innings ${i + 1}`;
      innings.push({
        label,
        batting: parseBattingList(inn.batting),
        bowling: parseBowlingList(inn.bowling),
      });
    }
    if (innings.some((x) => x.batting.length || x.bowling.length)) {
      return { innings, teams };
    }
  }

  const legacy = parseLegacyInnings(d);
  if (legacy.length) {
    return { innings: legacy, teams };
  }

  return null;
}
