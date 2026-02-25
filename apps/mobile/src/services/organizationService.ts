import { supabase } from './supabase';
import type { Organization, OrganizationMember, OrgRole } from '../types/database';

export interface OrgWithRole extends Organization {
  role: OrgRole;
  member_count?: number;
}

export async function getMyOrganizations(): Promise<OrgWithRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memberships, error: memErr } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id);

  if (memErr) throw memErr;
  if (!memberships || memberships.length === 0) return [];

  const orgIds = memberships.map((m) => m.organization_id);
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds)
    .order('created_at', { ascending: false });

  if (orgErr) throw orgErr;

  const roleMap = new Map(memberships.map((m) => [m.organization_id, m.role]));

  return (orgs ?? []).map((org) => ({
    ...org,
    role: roleMap.get(org.id) ?? 'member',
  }));
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createOrganization(
  org: Pick<Organization, 'name' | 'description' | 'icon' | 'color'>,
  userId: string
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .insert({ ...org, created_by: userId })
    .select()
    .single();

  if (error) throw error;

  // Auto-add creator as owner
  await supabase.from('organization_members').insert({
    organization_id: data.id,
    user_id: userId,
    role: 'owner' as OrgRole,
  });

  return data;
}

export async function updateOrganization(
  id: string,
  updates: Partial<Pick<Organization, 'name' | 'description' | 'icon' | 'color'>>
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteOrganization(id: string): Promise<void> {
  // Unlink meetings first (set org_id to null so they become personal)
  await supabase
    .from('meetings')
    .update({ organization_id: null })
    .eq('organization_id', id);

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOrgMembers(orgId: string): Promise<(OrganizationMember & { email?: string; full_name?: string })[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, profiles:user_id(email, full_name)')
    .eq('organization_id', orgId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    email: row.profiles?.email,
    full_name: row.profiles?.full_name,
  }));
}

export async function addOrgMember(orgId: string, userId: string, role: OrgRole = 'member'): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: userId, role });

  if (error) throw error;
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function inviteMemberByEmail(orgId: string, email: string): Promise<{ success: boolean; message: string }> {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile) return { success: false, message: 'No user found with that email' };

  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (existing) return { success: false, message: 'User is already a member' };

  await addOrgMember(orgId, profile.id, 'member');
  return { success: true, message: 'Member added successfully' };
}
