import { supabase } from './supabase';
import type { ActionItem, ActionItemStatus } from '../types/database';

export async function getActionItemsByMeeting(meetingId: string): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getOpenActionItems(): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('status', 'open')
    .order('deadline', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateActionItemStatus(
  id: string,
  status: ActionItemStatus
): Promise<ActionItem> {
  const { data, error } = await supabase
    .from('action_items')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
