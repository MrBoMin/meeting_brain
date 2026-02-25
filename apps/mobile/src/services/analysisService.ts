import { supabase } from './supabase';
import type { MeetingNote } from '../types/database';

export async function getMeetingNote(meetingId: string): Promise<MeetingNote | null> {
  const { data, error } = await supabase
    .from('meeting_notes')
    .select('*')
    .eq('meeting_id', meetingId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
