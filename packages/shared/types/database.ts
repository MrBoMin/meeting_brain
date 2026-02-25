// Shared TypeScript types — single source of truth for all packages
// Aligned with packages/supabase/schema.sql

export type MeetingType = 'in-person' | 'online-bot';
export type MeetingStatus = 'recording' | 'processing' | 'analyzing' | 'linking' | 'done' | 'failed';
export type LanguageCode = 'my-MM' | 'en-US' | 'auto';
export type NodeType = 'meeting' | 'note' | 'action' | 'decision';
export type EdgeRelation = 'continues' | 'references' | 'contradicts' | 'resolves';
export type ActionItemPriority = 'high' | 'medium' | 'low';
export type ActionItemStatus = 'open' | 'done' | 'cancelled';
export type OrgRole = 'owner' | 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: LanguageCode;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  meeting_type: MeetingType;
  platform: string | null;
  meeting_url: string | null;
  language_code: LanguageCode;
  status: MeetingStatus;
  audio_path: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  meeting_id: string;
  speaker_label: string | null;
  text: string;
  start_seconds: number;
  end_seconds: number;
  confidence: number | null;
  language: string;
  created_at: string;
}

export interface MeetingNote {
  id: string;
  meeting_id: string;
  summary: string;
  decisions: string[];
  open_questions: string[];
  raw_analysis: Record<string, unknown> | null;
  embedding: number[] | null;
  model_version: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: string;
  user_id: string;
  node_type: NodeType;
  title: string;
  content: string | null;
  embedding: number[] | null;
  source_meeting_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  from_node: string;
  to_node: string;
  relation: EdgeRelation;
  strength: number;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}
