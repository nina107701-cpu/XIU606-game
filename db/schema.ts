import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardScores = sqliteTable(
  "leaderboard_scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerKey: text("player_key").notNull(),
    displayName: text("display_name").notNull(),
    bestScore: integer("best_score").notNull().default(0),
    plays: integer("plays").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("leaderboard_scores_player_key_idx").on(table.playerKey),
    index("leaderboard_scores_best_score_idx").on(table.bestScore),
  ],
);
