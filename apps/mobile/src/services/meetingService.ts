import { supabase } from './supabase';
import type { Meeting, MeetingStatus } from '../types/database';

export async function getMeetings(organizationId?: string | null): Promise<Meeting[]> {
  let query = supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else if (organizationId === null) {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01') {
      return [];
    }
    throw error;
  }
  return data ?? [];
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createMeeting(
  meeting: Pick<Meeting, 'title' | 'meeting_type' | 'language_code'> & { user_id: string; organization_id?: string | null }
): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      ...meeting,
      status: 'recording' as MeetingStatus,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeetingStatus(
  id: string,
  status: MeetingStatus,
  extra?: Partial<Pick<Meeting, 'ended_at' | 'duration_seconds' | 'audio_path'>>
): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .update({ status, ...extra })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMeetingTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('meetings')
    .update({ title })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteMeeting(id: string): Promise<void> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select('audio_path')
    .eq('id', id)
    .single();

  const { data: nodes } = await supabase
    .from('nodes')
    .select('id')
    .eq('source_meeting_id', id);

  if (nodes && nodes.length > 0) {
    const nodeIds = nodes.map((n: { id: string }) => n.id);
    await supabase.from('edges').delete().in('from_node', nodeIds);
    await supabase.from('edges').delete().in('to_node', nodeIds);
    await supabase.from('nodes').delete().eq('source_meeting_id', id);
  }

  if (meeting?.audio_path) {
    await supabase.storage.from('meeting-audio').remove([meeting.audio_path]);
  }

  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
