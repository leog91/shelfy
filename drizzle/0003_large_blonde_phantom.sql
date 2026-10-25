CREATE TABLE `clipsy_connection` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clipsy_pending` (
	`user_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`state_hash` text NOT NULL,
	`encrypted_verifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`exchanging` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clipsy_pending_state_hash_unique` ON `clipsy_pending` (`state_hash`);