CREATE TABLE `leaderboard_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_key` text NOT NULL,
	`display_name` text NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`plays` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaderboard_scores_player_key_unique` ON `leaderboard_scores` (`player_key`);--> statement-breakpoint
CREATE INDEX `leaderboard_scores_best_score_idx` ON `leaderboard_scores` (`best_score`);