import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import { useAuth } from '../../src/hooks/useAuth';
import { useOrganization } from '../../src/contexts/OrganizationContext';
import {
  getOrganizationById,
  getOrgMembers,
  updateOrganization,
  deleteOrganization,
  inviteMemberByEmail,
  removeOrgMember,
} from '../../src/services/organizationService';
import type { OrgRole } from '../../src/types/database';

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: '👑 Owner',
  admin: '🛡️ Admin',
  member: '👤 Member',
};

export default function OrgDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { refresh: refreshOrgs, setActiveOrgId } = useOrganization();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const { data: org, isLoading: orgLoading, refetch: refetchOrg } = useQuery({
    queryKey: ['org', id],
    queryFn: () => getOrganizationById(id!),
    enabled: !!id,
  });

  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ['org-members', id],
    queryFn: () => getOrgMembers(id!),
    enabled: !!id,
  });

  useFocusEffect(
    useCallback(() => {
      refetchOrg();
      refetchMembers();
    }, [refetchOrg, refetchMembers])
  );

  const myRole = members?.find((m) => m.user_id === user?.id)?.role;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const result = await inviteMemberByEmail(id!, inviteEmail.trim());
      if (result.success) {
        Alert.alert('Success', result.message);
        setInviteEmail('');
        refetchMembers();
      } else {
        Alert.alert('Could not add', result.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string, userId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from this organization?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeOrgMember(id!, userId);
            refetchMembers();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    try {
      await updateOrganization(id!, { name: editName.trim() });
      setIsEditing(false);
      refetchOrg();
      refreshOrgs();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Organization',
      'This will unlink all meetings from this organization. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrganization(id!);
              setActiveOrgId(null);
              await refreshOrgs();
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  if (orgLoading || !org) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ title: 'Organization' }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: org.name }} />
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>
        {/* Header Card */}
        <View style={[s.headerCard, { backgroundColor: org.color }]}>
          <Text style={s.headerIcon}>{org.icon}</Text>
          {isEditing ? (
            <View style={s.editRow}>
              <TextInput
                style={s.editInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
              />
              <TouchableOpacity style={s.editSaveBtn} onPress={handleSaveName}>
                <Text style={s.editSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { if (isAdmin) { setEditName(org.name); setIsEditing(true); } }}>
              <Text style={s.headerName}>{org.name}</Text>
            </TouchableOpacity>
          )}
          {org.description && <Text style={s.headerDesc}>{org.description}</Text>}
          <Text style={s.headerMeta}>{members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''}</Text>
        </View>

        {/* Members Section */}
        <Text style={s.sectionTitle}>Members</Text>
        <View style={s.membersCard}>
          {members?.map((m) => (
            <View key={m.id} style={s.memberRow}>
              <View style={s.memberAvatar}>
                <Text style={s.memberAvatarText}>
                  {(m.full_name || m.email || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.memberInfo}>
                <Text style={s.memberName}>{m.full_name || m.email || 'Unknown'}</Text>
                <Text style={s.memberRole}>{ROLE_LABEL[m.role as OrgRole]}</Text>
              </View>
              {isAdmin && m.role !== 'owner' && m.user_id !== user?.id && (
                <TouchableOpacity
                  style={s.memberRemoveBtn}
                  onPress={() => handleRemoveMember(m.id, m.user_id, m.full_name || m.email || 'this user')}
                >
                  <Text style={s.memberRemoveText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Invite Section */}
        {isAdmin && (
          <>
            <Text style={s.sectionTitle}>Invite Member</Text>
            <View style={s.inviteCard}>
              <TextInput
                style={s.inviteInput}
                placeholder="Enter email address"
                placeholderTextColor={Colors.textMuted}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[s.inviteBtn, isInviting && { opacity: 0.6 }]}
                onPress={handleInvite}
                disabled={isInviting}
              >
                {isInviting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.inviteBtnText}>Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <>
            <Text style={[s.sectionTitle, { color: Colors.danger, marginTop: 32 }]}>Danger Zone</Text>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>Delete Organization</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  headerCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    ...shadow2,
  },
  headerIcon: { fontSize: 52, marginBottom: 12 },
  headerName: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center' },
  headerDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  headerMeta: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: '700' },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    minWidth: 180,
  },
  editSaveBtn: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  editSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.3,
  },

  membersCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadow1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  memberRole: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  memberRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.badgeFailed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberRemoveText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },

  inviteCard: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  inviteInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    ...shadow1,
  },
  inviteBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  deleteBtn: {
    backgroundColor: Colors.badgeFailed,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...shadow1,
  },
  deleteBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 16 },
});
