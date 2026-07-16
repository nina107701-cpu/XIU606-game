DROP INDEX `leaderboard_scores_player_key_unique`;--> statement-breakpoint
CREATE INDEX `leaderboard_scores_player_key_idx` ON `leaderboard_scores` (`player_key`);