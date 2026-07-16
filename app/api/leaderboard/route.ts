import { asc, count, desc, eq, gt, sum } from "drizzle-orm";
import { getDb } from "../../../db";
import { leaderboardScores } from "../../../db/schema";

const MAX_NAME_LENGTH = 12;
const MAX_SCORE = 5_000_000;
const GITHUB_PAGES_ORIGIN = "https://nina107701-cpu.github.io";

type LeaderboardRow = {
  id: number;
  rank: number;
  name: string;
  score: number;
  playedAt: string;
};

function cleanName(value: unknown) {
  if (typeof value !== "string") return null;
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const length = Array.from(displayName).length;
  if (length < 1 || length > MAX_NAME_LENGTH) return null;
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(displayName)) return null;
  return {
    displayName,
    playerKey: displayName.toLocaleLowerCase("zh-TW"),
  };
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "排行榜正在初始化，請稍後再試。";
  }
  return "排行榜目前無法連線，請稍後再試。";
}

function corsHeaders(request: Request) {
  const headers = new Headers();
  if (request.headers.get("origin") === GITHUB_PAGES_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", GITHUB_PAGES_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

async function scoreRank(score: number) {
  const db = getDb();
  const [higher] = await db
    .select({ total: count() })
    .from(leaderboardScores)
    .where(gt(leaderboardScores.bestScore, score));
  return Number(higher?.total ?? 0) + 1;
}

async function leaderboardPayload(name?: string | null, submissionId?: number) {
  const db = getDb();
  const rows = await db
    .select({
      id: leaderboardScores.id,
      name: leaderboardScores.displayName,
      score: leaderboardScores.bestScore,
      playedAt: leaderboardScores.createdAt,
    })
    .from(leaderboardScores)
    .orderBy(
      desc(leaderboardScores.bestScore),
      asc(leaderboardScores.createdAt),
      asc(leaderboardScores.id),
    );

  let lastScore: number | null = null;
  let currentRank = 0;
  const leaderboard: LeaderboardRow[] = rows.map((row, index) => {
    if (row.score !== lastScore) currentRank = index + 1;
    lastScore = row.score;
    return { rank: currentRank, ...row };
  });

  let submission: LeaderboardRow | null = null;
  if (submissionId !== undefined) {
    const submitted = leaderboard.find((row) => row.id === submissionId);
    if (submitted) submission = submitted;
  }

  const cleaned = cleanName(name);
  if (!cleaned) {
    return { leaderboard, player: null, submission };
  }

  const [player] = await db
    .select({
      name: leaderboardScores.displayName,
      score: leaderboardScores.bestScore,
    })
    .from(leaderboardScores)
    .where(eq(leaderboardScores.playerKey, cleaned.playerKey))
    .orderBy(
      desc(leaderboardScores.bestScore),
      asc(leaderboardScores.createdAt),
      asc(leaderboardScores.id),
    )
    .limit(1);

  if (!player) return { leaderboard, player: null, submission };

  const [totals] = await db
    .select({ plays: sum(leaderboardScores.plays) })
    .from(leaderboardScores)
    .where(eq(leaderboardScores.playerKey, cleaned.playerKey));

  return {
    leaderboard,
    player: {
      rank: await scoreRank(player.score),
      ...player,
      plays: Number(totals?.plays ?? 0),
    },
    submission,
  };
}

export async function GET(request: Request) {
  try {
    const name = new URL(request.url).searchParams.get("name");
    return jsonResponse(request, await leaderboardPayload(name));
  } catch (error) {
    return jsonResponse(request, { error: routeError(error) }, 500);
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { name?: unknown; score?: unknown };
    const cleaned = cleanName(payload.name);
    const score = Number(payload.score);

    if (!cleaned) {
      return jsonResponse(
        request,
        { error: `暱稱需為 1–${MAX_NAME_LENGTH} 個中英文字、數字、空格或 _.-` },
        400,
      );
    }
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
      return jsonResponse(request, { error: "分數格式不正確" }, 400);
    }

    const db = getDb();
    const [inserted] = await db
      .insert(leaderboardScores)
      .values({
        playerKey: cleaned.playerKey,
        displayName: cleaned.displayName,
        bestScore: score,
      })
      .returning({ id: leaderboardScores.id });

    return jsonResponse(
      request,
      await leaderboardPayload(cleaned.displayName, inserted.id),
      201,
    );
  } catch (error) {
    return jsonResponse(request, { error: routeError(error) }, 500);
  }
}
