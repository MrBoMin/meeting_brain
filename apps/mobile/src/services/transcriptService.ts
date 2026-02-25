import { supabase } from './supabase';
import type { Transcript } from '../types/database';

export async function getTranscriptsByMeeting(
  meetingId: string
): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('start_seconds', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
