import { supabase } from './supabase';

interface SearchResult {
  id: string;
  node_type: string;
  title: string;
  content: string | null;
  source_meeting_id: string | null;
  similarity: number;
  meeting_title: string | null;
  meeting_date: string | null;
}

export async function searchMeetings(
  query: string,
  userId: string,
  limit = 10
): Promise<SearchResult[]> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const url = `${supabaseUrl}/functions/v1/search-meetings`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ query, user_id: userId, limit }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Search failed');
  return data.results ?? [];
}

export async function getRelatedMeetings(meetingId: string) {
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id')
    .eq('source_meeting_id', meetingId);

  if (!nodes || nodes.length === 0) return [];

  const nodeIds = nodes.map((n: { id: string }) => n.id);

  const { data: edges } = await supabase
    .from('edges')
    .select('from_node, to_node, relation, strength')
    .or(`from_node.in.(${nodeIds.join(',')}),to_node.in.(${nodeIds.join(',')})`)
    .order('strength', { ascending: false });

  if (!edges || edges.length === 0) return [];

  const relatedNodeIds = new Set<string>();
  for (const edge of edges) {
    if (!nodeIds.includes(edge.from_node)) relatedNodeIds.add(edge.from_node);
    if (!nodeIds.includes(edge.to_node)) relatedNodeIds.add(edge.to_node);
  }

  if (relatedNodeIds.size === 0) return [];

  const { data: relatedNodes } = await supabase
    .from('nodes')
    .select('id, title, node_type, source_meeting_id')
    .in('id', Array.from(relatedNodeIds));

  const relatedMeetingIds = new Set<string>();
  for (const node of relatedNodes || []) {
    if (node.source_meeting_id && node.source_meeting_id !== meetingId) {
      relatedMeetingIds.add(node.source_meeting_id);
    }
  }

  if (relatedMeetingIds.size === 0) return [];

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, created_at, status')
    .in('id', Array.from(relatedMeetingIds))
    .order('created_at', { ascending: false });

  return meetings ?? [];
}
