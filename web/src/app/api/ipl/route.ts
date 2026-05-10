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

type MatchPayload = CurrentMatch & {
  liveScorecard: ParsedScorecard | null;
  scorecardReason: string | null;
  /** Full squad only when live scorecard is unavailable (squad ≠ playing XI). */
  squad: SquadTeam[] | null;
};

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

    const ipl = list.data.filter((m) => isIplMatchName(m.name));

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
