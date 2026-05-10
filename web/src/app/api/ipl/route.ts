import { NextResponse } from "next/server";
import {
  type CurrentMatch,
  type SquadTeam,
  fetchCricapi,
  isIplMatchName,
} from "@/lib/cricapi";
import { parseMatchScorecardPayload, type ParsedScorecard } from "@/lib/matchScorecard";

export const dynamic = "force-dynamic";

type CricapiEnvelope<T> = {
  status: string;
  reason?: string;
  data: T;
  info?: unknown;
};

type SeriesSummary = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
};

type SeriesInfoPayload = {
  matchList?: CurrentMatch[];
};

type MatchPayload = CurrentMatch & {
  liveScorecard: ParsedScorecard | null;
  scorecardReason: string | null;
  /** Full squad only when live scorecard is unavailable (squad ≠ playing XI). */
  squad: SquadTeam[] | null;
};

function pickCurrentYearIplSeries(series: SeriesSummary[]): SeriesSummary | null {
  const year = String(new Date().getUTCFullYear());
  const filtered = series.filter((s) =>
    s.name.toLowerCase().includes("indian premier league"),
  );
  if (filtered.length === 0) return null;
  return (
    filtered.find((s) => s.name.includes(year)) ??
    filtered[0] ??
    null
  );
}

export async function GET() {
  const apiKey = process.env.CRICAPI_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Set CRICAPI_KEY in .env.local (see .env.example)." },
      { status: 500 },
    );
  }

  try {
    const list = await fetchCricapi<CricapiEnvelope<CurrentMatch[]>>(
      "currentMatches",
      apiKey,
      { offset: "0" },
    );

    if (list.status !== "success" || !Array.isArray(list.data)) {
      return NextResponse.json(
        { error: list.reason ?? "Could not load current matches." },
        { status: 502 },
      );
    }

    const byId = new Map<string, CurrentMatch>();
    for (const m of list.data.filter((x) => isIplMatchName(x.name))) {
      byId.set(m.id, m);
    }

    // CricAPI occasionally omits IPL fixtures from `currentMatches`.
    // Fallback to the IPL series match list and include any live games.
    try {
      const seriesRes = await fetchCricapi<CricapiEnvelope<SeriesSummary[]>>(
        "series",
        apiKey,
        { offset: "0", search: "indian premier league" },
      );
      if (seriesRes.status === "success" && Array.isArray(seriesRes.data)) {
        const currentIpl = pickCurrentYearIplSeries(seriesRes.data);
        if (currentIpl?.id) {
          const seriesInfo = await fetchCricapi<CricapiEnvelope<SeriesInfoPayload>>(
            "series_info",
            apiKey,
            { id: currentIpl.id },
          );
          const matchList = seriesInfo.data?.matchList;
          if (seriesInfo.status === "success" && Array.isArray(matchList)) {
            for (const m of matchList) {
              if (m.matchStarted && !m.matchEnded) {
                byId.set(m.id, m);
              }
            }
          }
        }
      }
    } catch {
      // Keep using `currentMatches` only when fallback lookup fails.
    }

    const ipl = [...byId.values()];

    const matches: MatchPayload[] = await Promise.all(
      ipl.map(async (m) => {
        let liveScorecard: ParsedScorecard | null = null;
        let scorecardReason: string | null = null;

        try {
          const scRes = await fetchCricapi<
            CricapiEnvelope<Record<string, unknown>>
          >("match_scorecard", apiKey, { offset: "0", id: m.id });

          if (scRes.status === "success" && scRes.data) {
            liveScorecard = parseMatchScorecardPayload({
              data: scRes.data,
            });
            if (!liveScorecard) {
              scorecardReason = "Scorecard payload had no innings data.";
            }
          } else {
            scorecardReason = scRes.reason ?? "Scorecard unavailable.";
          }
        } catch {
          scorecardReason = "Scorecard request failed.";
        }

        let squad: SquadTeam[] | null = null;
        if (!liveScorecard && m.hasSquad) {
          try {
            const squadRes = await fetchCricapi<CricapiEnvelope<SquadTeam[]>>(
              "match_squad",
              apiKey,
              { offset: "0", id: m.id },
            );
            if (squadRes.status === "success" && Array.isArray(squadRes.data)) {
              squad = squadRes.data;
            }
          } catch {
            squad = null;
          }
        }

        return {
          ...m,
          liveScorecard,
          scorecardReason: liveScorecard ? null : scorecardReason,
          squad,
        };
      }),
    );

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      matches,
      apiInfo: list.info ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
