-- MeetingBrain Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- Aligned with MeetingBrain_CursorDoc.docx

-- Enable pgvector extension for knowledge graph embeddings
create extension if not exists vector with schema extensions;

-- Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  preferred_language text not null default 'my-MM',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Meetings
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  title text not null,
  description text,
  meeting_type text not null check (meeting_type in ('in-person', 'online-bot')),
  platform text,
  meeting_url text,
  language_code text not null default 'my-MM',
  status text not null default 'recording'
    check (status in ('recording', 'processing', 'analyzing', 'linking', 'done', 'failed')),
  audio_path text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transcripts (one row per speech segment)
create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  speaker_label text,
  text text not null,
  start_seconds float8 not null,
  end_seconds float8 not null,
  confidence float8,
  language text not null default 'my-MM',
  created_at timestamptz not null default now()
);

-- Meeting Notes (AI-generated analysis)
create table if not exists meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  summary text not null,
  decisions jsonb not null default '[]',
  open_questions jsonb not null default '[]',
  raw_analysis jsonb,
  embedding vector(3072),
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Action Items (standalone table with lifecycle tracking)
create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  task text not null,
  owner text,
  deadline timestamptz,
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  status text not null default 'open'
    check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text default '🏢',
  color text default '#5B4CFF',
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organization Members (many-to-many)
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- Knowledge Graph: Nodes
create table if not exists nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  node_type text not null
    check (node_type in ('meeting', 'note', 'action', 'decision')),
  title text not null,
  content text,
  embedding vector(3072),
  source_meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Knowledge Graph: Edges
create table if not exists edges (
  id uuid primary key default gen_random_uuid(),
  from_node uuid not null references nodes(id) on delete cascade,
  to_node uuid not null references nodes(id) on delete cascade,
  relation text not null
    check (relation in ('continues', 'references', 'contradicts', 'resolves')),
  strength float8 not null default 1.0 check (strength >= 0.0 and strength <= 1.0),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_meetings_user_id on meetings(user_id);
create index if not exists idx_meetings_status on meetings(status);
create index if not exists idx_transcripts_meeting_id on transcripts(meeting_id);
create index if not exists idx_meeting_notes_meeting_id on meeting_notes(meeting_id);
create index if not exists idx_action_items_meeting_id on action_items(meeting_id);
create index if not exists idx_action_items_status on action_items(status);
create index if not exists idx_nodes_user_id on nodes(user_id);
create index if not exists idx_nodes_source_meeting on nodes(source_meeting_id);
create index if not exists idx_nodes_type on nodes(node_type);
create index if not exists idx_edges_from on edges(from_node);
create index if not exists idx_edges_to on edges(to_node);

-- Row Level Security
alter table profiles enable row level security;
alter table meetings enable row level security;
alter table transcripts enable row level security;
alter table meeting_notes enable row level security;
alter table action_items enable row level security;
alter table nodes enable row level security;
alter table edges enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can view own meetings"
  on meetings for select using (auth.uid() = user_id);
create policy "Users can insert own meetings"
  on meetings for insert with check (auth.uid() = user_id);
create policy "Users can update own meetings"
  on meetings for update using (auth.uid() = user_id);
create policy "Users can delete own meetings"
  on meetings for delete using (auth.uid() = user_id);

create policy "Users can view own transcripts"
  on transcripts for select using (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );
create policy "Users can insert own transcripts"
  on transcripts for insert with check (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );

create policy "Users can view own meeting notes"
  on meeting_notes for select using (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );
create policy "Users can insert own meeting notes"
  on meeting_notes for insert with check (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );

create policy "Users can view own action items"
  on action_items for select using (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );
create policy "Users can insert own action items"
  on action_items for insert with check (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );
create policy "Users can update own action items"
  on action_items for update using (
    meeting_id in (select id from meetings where user_id = auth.uid())
  );

create policy "Users can view own nodes"
  on nodes for select using (auth.uid() = user_id);
create policy "Users can insert own nodes"
  on nodes for insert with check (auth.uid() = user_id);
create policy "Users can update own nodes"
  on nodes for update using (auth.uid() = user_id);
create policy "Users can delete own nodes"
  on nodes for delete using (auth.uid() = user_id);

create policy "Users can view own edges"
  on edges for select using (
    from_node in (select id from nodes where user_id = auth.uid())
  );
create policy "Users can insert own edges"
  on edges for insert with check (
    from_node in (select id from nodes where user_id = auth.uid())
  );
create policy "Users can delete own edges"
  on edges for delete using (
    from_node in (select id from nodes where user_id = auth.uid())
  );

-- Trigger: auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger set_updated_at before update on meetings
  for each row execute function update_updated_at();
create trigger set_updated_at before update on meeting_notes
  for each row execute function update_updated_at();
create trigger set_updated_at before update on action_items
  for each row execute function update_updated_at();
create trigger set_updated_at before update on nodes
  for each row execute function update_updated_at();
