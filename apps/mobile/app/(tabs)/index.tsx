import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMeetings, deleteMeeting } from '../../src/services/meetingService';
import { formatDate, formatDuration, formatDateRelative } from '../../src/utils/format';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2, shadow3 } from '../../src/constants/shadows';
import { useAuth } from '../../src/hooks/useAuth';
import { useOrganization } from '../../src/contexts/OrganizationContext';
import type { Meeting } from '../../src/types/database';

type Filter = 'all' | 'today' | 'week' | 'done';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'done', label: 'Completed' },
];

const STATUS_ICON: Record<string, string> = {
  done: '✅',
  processing: '⏳',
  analyzing: '🧠',
  linking: '🔗',
  failed: '❌',
  recording: '🎙️',
};

const TYPE_ICON: Record<string, string> = {
  'in-person': '🏢',
  virtual: '💻',
  phone: '📞',
  hybrid: '🔄',
};

function SwipeDeleteAction(progress: Animated.AnimatedInterpolation<number>) {
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  return (
    <Animated.View style={[styles.swipeAction, { opacity }]}>  
      <Text style={styles.swipeActionText}>Delete</Text>
    </Animated.View>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MeetingCard({ item, onPress }: { item: Meeting; onPress: () => void }) {
  const typeIcon = TYPE_ICON[item.meeting_type] || '📋';
  const statusIcon = STATUS_ICON[item.status] || '📋';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardRow}>
        <View style={styles.cardIconWrap}>
          <Text style={styles.cardIconText}>{typeIcon}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardDate}>{formatDateRelative(item.created_at)}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.statusIcon}>{statusIcon}</Text>
          {item.duration_seconds ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationIcon}>🕐</Text>
              <Text style={styles.durationText}>{formatDuration(item.duration_seconds)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {item.status !== 'done' && item.status !== 'failed' && (
        <View style={styles.cardProgress}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: item.status === 'processing' ? '33%' : item.status === 'analyzing' ? '66%' : item.status === 'linking' ? '90%' : '10%',
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {item.status === 'processing' ? 'Transcribing...' : item.status === 'analyzing' ? 'Analyzing...' : item.status === 'linking' ? 'Linking...' : 'Processing...'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { organizations, activeOrg, setActiveOrgId, refresh: refreshOrgs } = useOrganization();
  const queryClient = useQueryClient();
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [filter, setFilter] = useState<Filter>('all');

  const {
    data: meetings,
    isLoading,
    error,
    refetch,
  } = useQuery<Meeting[]>({
    queryKey: ['meetings', activeOrg?.id ?? 'personal'],
    queryFn: () => getMeetings(activeOrg?.id ?? null),
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshOrgs();
    }, [refetch, refreshOrgs])
  );

  const filteredMeetings = useMemo(() => {
    if (!meetings) return [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    switch (filter) {
      case 'today':
        return meetings.filter((m) => new Date(m.created_at) >= startOfDay);
      case 'week':
        return meetings.filter((m) => new Date(m.created_at) >= startOfWeek);
      case 'done':
        return meetings.filter((m) => m.status === 'done');
      default:
        return meetings;
    }
  }, [meetings, filter]);

  const stats = useMemo(() => {
    if (!meetings) return { total: 0, pending: 0, hours: '0' };
    const total = meetings.length;
    const pending = meetings.filter((m) => m.status !== 'done' && m.status !== 'failed').length;
    const totalSecs = meetings.reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0);
    const hours = (totalSecs / 3600).toFixed(1);
    return { total, pending, hours };
  }, [meetings]);

  const handleSwipeDelete = useCallback((meeting: Meeting) => {
    Alert.alert(
      'Delete Meeting',
      `Delete "${meeting.title}"? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRefs.current.get(meeting.id)?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeeting(meeting.id);
              queryClient.invalidateQueries({ queryKey: ['meetings'] });
            } catch {
              Alert.alert('Error', 'Failed to delete meeting');
              swipeableRefs.current.get(meeting.id)?.close();
            }
          },
        },
      ]
    );
  }, [queryClient]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.email?.split('@')[0] ?? 'there';

  if (isLoading) {
    return (
      <>

        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading meetings...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>

        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load meetings</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Hero Greeting Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>{greeting},</Text>
            <Text style={styles.heroName}>{userName}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.avatarBtn}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroSubtitle}>
          {activeOrg
            ? `${activeOrg.icon} ${activeOrg.name} — ${stats.total} meeting${stats.total !== 1 ? 's' : ''}`
            : meetings && meetings.length > 0
              ? `You have ${stats.total} meeting${stats.total !== 1 ? 's' : ''} recorded`
              : 'Start recording your first meeting'}
        </Text>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/record')}>
            <View style={[styles.quickIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.quickIcon}>🎙️</Text>
            </View>
            <Text style={styles.quickLabel}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/calendar')}>
            <View style={[styles.quickIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.quickIcon}>📅</Text>
            </View>
            <Text style={styles.quickLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/search')}>
            <View style={[styles.quickIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.quickIcon}>🔍</Text>
            </View>
            <Text style={styles.quickLabel}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Organization Switcher */}
      <View style={styles.orgRow}>
        <TouchableOpacity
          style={[styles.orgChip, !activeOrg && styles.orgChipActive]}
          onPress={() => setActiveOrgId(null)}
        >
          <Text style={styles.orgChipIcon}>👤</Text>
          <Text style={[styles.orgChipText, !activeOrg && styles.orgChipTextActive]}>Personal</Text>
        </TouchableOpacity>
        {organizations.map((org) => (
          <TouchableOpacity
            key={org.id}
            style={[styles.orgChip, activeOrg?.id === org.id && styles.orgChipActive]}
            onPress={() => setActiveOrgId(org.id)}
            onLongPress={() => router.push(`/org/${org.id}`)}
          >
            <Text style={styles.orgChipIcon}>{org.icon}</Text>
            <Text style={[styles.orgChipText, activeOrg?.id === org.id && styles.orgChipTextActive]} numberOfLines={1}>
              {org.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.orgAddChip}
          onPress={() => router.push('/org/create')}
        >
          <Text style={styles.orgAddText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      {meetings && meetings.length > 0 && (
        <View style={styles.statsRow}>
          <StatCard icon="📋" value={String(stats.total)} label="Meetings" color={Colors.primary} />
          <StatCard icon="⏱️" value={stats.hours + 'h'} label="Recorded" color={Colors.accent} />
          <StatCard icon="🔄" value={String(stats.pending)} label="Pending" color={Colors.warning} />
        </View>
      )}

      {/* Filter Tabs */}
      {meetings && meetings.length > 0 && (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Section Title */}
      {meetings && meetings.length > 0 && (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {filter === 'all' ? 'Recent Meetings' : filter === 'today' ? "Today's Meetings" : filter === 'week' ? 'This Week' : 'Completed'}
          </Text>
          <Text style={styles.sectionCount}>{filteredMeetings.length}</Text>
        </View>
      )}
    </View>
  );

  if (!meetings || meetings.length === 0) {
    return (
      <>

        <View style={styles.container}>
          <FlatList
            data={[]}
            keyExtractor={() => 'empty'}
            renderItem={null}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>{activeOrg ? activeOrg.icon : '🎙️'}</Text>
                  <Text style={styles.emptyTitle}>
                    {activeOrg ? `No meetings in ${activeOrg.name}` : 'No meetings yet'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {activeOrg
                      ? 'Record a meeting while this workspace is selected'
                      : 'Tap Record above to capture your first meeting'}
                  </Text>
                </View>
              </View>
            }
          />
        </View>
      </>
    );
  }

  return (
      <View style={styles.container}>
        <FlatList
          data={filteredMeetings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No meetings here</Text>
                <Text style={styles.emptySubtitle}>Try a different filter</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); }}
              renderRightActions={(progress) => SwipeDeleteAction(progress)}
              onSwipeableOpen={() => handleSwipeDelete(item)}
              overshootRight={false}
            >
              <MeetingCard
                item={item}
                onPress={() => router.push(`/meeting/${item.id}`)}
              />
            </Swipeable>
          )}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    ...shadow2,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 60,
    marginBottom: 20,
    ...shadow2,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  heroGreeting: {
    fontSize: 16,
    color: Colors.textOnDarkSecondary,
    fontWeight: '500',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textOnDark,
    letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.textOnDarkSecondary,
    fontWeight: '500',
    marginBottom: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickIcon: {
    fontSize: 24,
  },
  quickLabel: {
    fontSize: 12,
    color: Colors.textOnDarkSecondary,
    fontWeight: '600',
  },

  // Organization Switcher
  orgRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    ...shadow1,
  },
  orgChipActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  orgChipIcon: {
    fontSize: 16,
  },
  orgChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    maxWidth: 100,
  },
  orgChipTextActive: {
    color: '#fff',
  },
  orgAddChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.border + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAddText: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...shadow1,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    ...shadow1,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // Section Header
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
    backgroundColor: Colors.border + '60',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  list: {
    paddingBottom: 40,
  },

  // Meeting Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 12,
    ...shadow2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  cardDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusIcon: {
    fontSize: 18,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  durationIcon: {
    fontSize: 10,
  },
  durationText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  cardProgress: {
    marginTop: 14,
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Empty
  emptyContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    ...shadow1,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Swipe
  swipeAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 28,
    borderRadius: 20,
    marginBottom: 12,
    marginRight: 20,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
