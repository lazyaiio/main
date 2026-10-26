/** Row shapes for migration 0002. Kept explicit so queries do not depend on generated-type inference. */

export type Language = "en" | "bn";
export type ProjectInputType = "topic" | "url" | "website" | "csv";
export type ProjectStatus = "active" | "archived";
export type CampaignStatus =
  | "draft"
  | "planning"
  | "generating"
  | "ready"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type SlotStatus = "planned" | "generating" | "done" | "failed" | "skipped";
export type ApprovalStatus = "draft" | "awaiting_approval" | "approved" | "rejected" | "cancelled";
export type PostStatus = "scheduled" | "publishing" | "retrying" | "published" | "failed" | "cancelled";

export type ProjectSettings = {
  audience?: string;
  tone?: string;
  notes?: string;
};

export type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  input_type: ProjectInputType;
  input_value: string;
  languages: Language[];
  settings: ProjectSettings;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  duration_days: number;
  requested_item_count: number;
  status: CampaignStatus;
  languages: Language[];
  approval_mode: "manual" | "auto";
  generation_progress: { total?: number; completed?: number; failed?: number };
  created_at: string;
  updated_at: string;
};

/** What the campaign generator was asked to write (campaigns.brief). */
export type CampaignBrief = {
  topic?: string;
  tone?: string;
  audience?: string;
  notes?: string;
  cta?: string;
  length?: string;
  source_document_id?: string;
  source_url?: string;
};

export type CampaignDetail = CampaignRow & { brief: CampaignBrief; created_by: string | null };

export type CampaignSlotRow = {
  id: string;
  workspace_id: string;
  campaign_id: string;
  slot_index: number;
  planned_at: string;
  language: Language;
  content_format: string;
  theme: string | null;
  status: SlotStatus;
  attempts: number;
  last_error_code: string | null;
  content_item_id: string | null;
};

export type ContentItemRow = {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  project_id: string | null;
  language: Language;
  content_format: string;
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[];
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
};

export type ScheduledPostRow = {
  id: string;
  workspace_id: string;
  content_item_id: string;
  social_page_id: string;
  scheduled_at: string;
  status: PostStatus;
  last_error: string | null;
};

export type AuditEventRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ContentItemFull = ContentItemRow & {
  source_url: string | null;
  image_brief: string | null;
  content_hash: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  prompt_version: string | null;
  usage_metadata: {
    input_tokens?: number;
    output_tokens?: number;
    fact_check_flags?: string[];
    repaired?: boolean;
    request?: Record<string, string>;
    source?: { document_id: string; url: string; title: string | null };
    campaign?: { id: string; slot_id: string; slot_index: number };
  };
};
