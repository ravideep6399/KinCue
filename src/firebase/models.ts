import type { HandoverExtraction } from "../ai/schemas";

export type FamilyRole = "owner" | "primary_caregiver" | "helper" | "viewer";

export type KinCueUser = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type FamilySpace = {
  id: string;
  name: string;
  ownerUid: string;
  timezone: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type FamilyMember = {
  userId: string;
  displayName: string;
  email: string;
  relationshipLabel: string | null;
  role: FamilyRole;
  joinedAt: unknown;
  updatedAt: unknown;
};

export type FamilySpaceMembership = {
  familySpaceId: string;
  name: string;
  timezone: string;
  role: FamilyRole;
  relationshipLabel: string | null;
  createdAt: unknown;
};

export type CareProfileStatus = "active" | "archived";

export type CareProfile = {
  id: string;
  linkedMemberUserId: string | null;
  fullName: string;
  preferredName: string | null;
  relationshipLabel: string | null;
  careNeedsSummary: string | null;
  status: CareProfileStatus;
  createdByUserId: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CareRoutineCategory =
  | "medication"
  | "meal"
  | "mobility"
  | "appointment"
  | "personal_care"
  | "general";

export type CareRoutineImportance = "routine" | "important" | "critical";

export type CareRoutine = {
  id: string;
  careProfileId: string;
  title: string;
  instructions: string;
  category: CareRoutineCategory;
  importance: CareRoutineImportance;
  timeOfDay: string | null;
  daysOfWeek: number[];
  active: boolean;
  createdByUserId: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CareShiftStatus =
  | "pending"
  | "accepted"
  | "active"
  | "completed"
  | "declined";

export type CareShift = {
  id: string;
  careProfileId: string;
  title: string;
  primaryUserId: string;
  backupUserId: string | null;
  startsAt: unknown;
  endsAt: unknown;
  acceptanceDeadline: unknown | null;
  status: CareShiftStatus;
  acceptedAt: unknown | null;
  acceptedByUserId: string | null;
  declinedAt: unknown | null;
  declinedByUserId: string | null;
  createdByUserId: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CueOccurrenceStatus =
  | "upcoming"
  | "due"
  | "completed"
  | "snoozed"
  | "blocked"
  | "skipped"
  | "overdue";

export type CueOccurrence = {
  id: string;
  cueId: string;
  careProfileId: string | null;
  shiftId: string | null;
  title: string;
  instructions: string;
  importance: CareRoutineImportance;
  assignedUserId: string | null;
  scheduledAt: unknown;
  status: CueOccurrenceStatus;
  acknowledgedAt: unknown | null;
  snoozedUntil: unknown | null;
  blockedReason: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export type PlaybookCategory =
  | "utilities"
  | "appliances"
  | "documents"
  | "contacts"
  | "emergency"
  | "general";

export type PlaybookEntry = {
  id: string;
  title: string;
  category: PlaybookCategory;
  details: string;
  locationLabel: string | null;
  reminderAt: unknown | null;
  assignedUserId: string | null;
  active: boolean;
  createdByUserId: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type HandoverRecord = {
  id: string;
  transcript: string;
  summary: string;
  items: HandoverExtraction["items"];
  unresolvedQuestions: string[];
  createdByUserId: string;
  createdByDisplayName: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type VaultDocumentCategory = "care" | "identity" | "household" | "insurance" | "other";

export type VaultDocument = {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  size: number;
  category: VaultDocumentCategory;
  description: string | null;
  uploadedByUserId: string;
  uploadedByDisplayName: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type ActivityEvent = {
  id: string;
  type: string;
  summary: string;
  actorUserId: string;
  actorDisplayName: string;
  createdAt: unknown;
};
