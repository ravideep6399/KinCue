import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
};

export const familySpaces = sqliteTable("family_spaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  ...timestamps,
});

export const familyPeople = sqliteTable("family_people", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  linkedUserEmail: text("linked_user_email"),
  displayName: text("display_name").notNull(),
  relationshipLabel: text("relationship_label"),
  initials: text("initials").notNull(),
  ...timestamps,
});

export const familyMemberships = sqliteTable("family_memberships", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  personId: text("person_id").notNull(),
  userEmail: text("user_email").notNull(),
  role: text("role", {
    enum: ["owner", "primary_caregiver", "helper", "viewer"],
  }).notNull(),
  ...timestamps,
});

export const careProfiles = sqliteTable("care_profiles", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  personId: text("person_id").notNull(),
  summary: text("summary"),
  ...timestamps,
});

export const careShifts = sqliteTable("care_shifts", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  careProfileId: text("care_profile_id").notNull(),
  title: text("title").notNull(),
  primaryPersonId: text("primary_person_id").notNull(),
  backupPersonId: text("backup_person_id"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", {
    enum: ["pending", "accepted", "active", "completed", "declined"],
  }).notNull(),
  ...timestamps,
});

export const instructions = sqliteTable("instructions", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  careProfileId: text("care_profile_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceDocumentId: text("source_document_id"),
  verificationStatus: text("verification_status", {
    enum: ["pending", "family_verified", "professional_source", "outdated"],
  }).notNull(),
  verifiedByPersonId: text("verified_by_person_id"),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const cues = sqliteTable("cues", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  careProfileId: text("care_profile_id"),
  instructionId: text("instruction_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  importance: text("importance", {
    enum: ["routine", "important", "critical"],
  }).notNull(),
  timezone: text("timezone").notNull(),
  recurrenceJson: text("recurrence_json"),
  primaryPersonId: text("primary_person_id"),
  backupPersonId: text("backup_person_id"),
  escalationMinutes: integer("escalation_minutes"),
  ...timestamps,
});

export const cueOccurrences = sqliteTable("cue_occurrences", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  cueId: text("cue_id").notNull(),
  assignedPersonId: text("assigned_person_id"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", {
    enum: ["upcoming", "due", "completed", "snoozed", "blocked", "skipped", "overdue"],
  }).notNull(),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const handovers = sqliteTable("handovers", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  careShiftId: text("care_shift_id"),
  createdByPersonId: text("created_by_person_id").notNull(),
  transcript: text("transcript").notNull(),
  summary: text("summary"),
  status: text("status", { enum: ["draft", "review", "confirmed"] }).notNull(),
  ...timestamps,
});

export const handoverItems = sqliteTable("handover_items", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  handoverId: text("handover_id").notNull(),
  type: text("type").notNull(),
  extractedJson: text("extracted_json").notNull(),
  sourceExcerpt: text("source_excerpt").notNull(),
  confidence: text("confidence").notNull(),
  verificationStatus: text("verification_status", {
    enum: ["pending", "confirmed", "rejected"],
  }).notNull(),
  ...timestamps,
});

export const playbookEntries = sqliteTable("playbook_entries", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  location: text("location"),
  ownerPersonId: text("owner_person_id"),
  ...timestamps,
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByPersonId: text("uploaded_by_person_id").notNull(),
  ...timestamps,
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  familySpaceId: text("family_space_id").notNull(),
  actorPersonId: text("actor_person_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  detailsJson: text("details_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
