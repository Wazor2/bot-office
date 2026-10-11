CREATE TABLE `provider_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`encryptedKey` text NOT NULL,
	`keyLastFour` varchar(4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_credentials_owner_provider_unique` UNIQUE(`userId`,`providerId`)
);
--> statement-breakpoint
ALTER TABLE `provider_credentials` ADD CONSTRAINT `provider_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;