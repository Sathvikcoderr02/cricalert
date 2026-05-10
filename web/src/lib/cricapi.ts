export const CRICAPI_BASE = "https://api.cricapi.com/v1";

export type ScoreInning = {
  r: number;
  w: number;
  o: number;
  inning: string;
};

export type CurrentMatch = {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: { name: string; shortname: string; img: string }[];
  series_id: string;
  fantasyEnabled?: boolean;
  bbbEnabled?: boolean;
  hasSquad: boolean;
  matchStarted: boolean;
  matchEnded: boolean;
  score?: ScoreInning[];
};

export type SquadPlayer = {
  id: string;
  name: string;
  role: string;
  battingStyle?: string;
  bowlingStyle?: string;
  country?: string;
  playerImg?: string;
};

export type SquadTeam = {
  teamName: string;
  shortname: string;
  img?: string;
  players: SquadPlayer[];
};

export function isIplMatchName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes("indian premier league")) return true;
  if (lower.includes("tata ipl")) return true;
  if (/\b(ipl)\b.*20\d{2}/i.test(name)) return true;
  if (/, ipl,/i.test(name)) return true;
  return false;
}

export async function fetchCricapi<T>(
  path: string,
  apiKey: string,
  searchParams: Record<string, string>,
): Promise<T> {
  const url = new URL(`${CRICAPI_BASE}/${path}`);
  url.searchParams.set("apikey", apiKey);
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CricAPI ${path}: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
