CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`actor_person_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`details_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `care_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`person_id` text NOT NULL,
	`summary` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `care_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`care_profile_id` text NOT NULL,
	`title` text NOT NULL,
	`primary_person_id` text NOT NULL,
	`backup_person_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cue_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`cue_id` text NOT NULL,
	`assigned_person_id` text,
	`scheduled_at` integer NOT NULL,
	`status` text NOT NULL,
	`acknowledged_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cues` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`care_profile_id` text,
	`instruction_id` text,
	`title` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`importance` text NOT NULL,
	`timezone` text NOT NULL,
	`recurrence_json` text,
	`primary_person_id` text,
	`backup_person_id` text,
	`escalation_minutes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by_person_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`person_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_people` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`linked_user_email` text,
	`display_name` text NOT NULL,
	`relationship_label` text,
	`initials` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handover_items` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`handover_id` text NOT NULL,
	`type` text NOT NULL,
	`extracted_json` text NOT NULL,
	`source_excerpt` text NOT NULL,
	`confidence` text NOT NULL,
	`verification_status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handovers` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`care_shift_id` text,
	`created_by_person_id` text NOT NULL,
	`transcript` text NOT NULL,
	`summary` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instructions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`care_profile_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`source_document_id` text,
	`verification_status` text NOT NULL,
	`verified_by_person_id` text,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playbook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`family_space_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`location` text,
	`owner_person_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
