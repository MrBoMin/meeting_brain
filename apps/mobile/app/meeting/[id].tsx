import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMeetingById, deleteMeeting, updateMeetingTitle } from '../../src/services/meetingService';
import { getTranscriptsByMeeting } from '../../src/services/transcriptService';
import { getMeetingNote } from '../../src/services/analysisService';
import { getActionItemsByMeeting, updateActionItemStatus } from '../../src/services/actionItemService';
import { getRelatedMeetings } from '../../src/services/graphService';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import { formatDate } from '../../src/utils/format';
import type { Meeting, Transcript, MeetingNote, ActionItem } from '../../src/types/database';

const SPEAKER_COLORS = [
  '#5B4CFF', '#00BFA6', '#F59E0B', '#FF3B30', '#8B5CF6', '#EC4899',
];

function getSpeakerColor(label: string | null): string {
  if (!label) return Colors.primary;
  const num = parseInt(label.replace(/\D/g, ''), 10) || 0;
  return SPEAKER_COLORS[num % SPEAKER_COLORS.length];
}

function InfoBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.infoBadge}>
      <View style={s.infoBadgeIcon}>
        <Text style={s.infoBadgeEmoji}>{icon}</Text>
      </View>
      <Text style={s.infoBadgeText}>{text}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; fg: string; icon: string }> = {
    done:       { bg: '#DCFCE7', fg: '#16A34A', icon: '✅' },
    analyzing:  { bg: '#EDE9FE', fg: '#7C3AED', icon: '🧠' },
    linking:    { bg: '#DBEAFE', fg: '#2563EB', icon: '🔗' },
    processing: { bg: '#FEF9C3', fg: '#CA8A04', icon: '⏳' },
    failed:     { bg: '#FEE2E2', fg: '#DC2626', icon: '❌' },
  };
  const { bg, fg, icon } = config[status] ?? { bg: Colors.border, fg: Colors.textSecondary, icon: '📋' };
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={s.pillIcon}>{icon}</Text>
      <Text style={[s.pillText, { color: fg }]}>{status}</Text>
    </View>
  );
}

function SectionHeader({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionIconWrap}>
        <Text style={s.sectionIcon}>{icon}</Text>
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function TranscriptBubble({ segment }: { segment: Transcript }) {
  const color = getSpeakerColor(segment.speaker_label);
  return (
    <View style={t.bubble}>
      <View style={t.bubbleHeader}>
        <View style={[t.dot, { backgroundColor: color }]} />
        <Text style={[t.speakerName, { color }]}>
          {segment.speaker_label || 'Speaker'}
        </Text>
      </View>
      <Text style={t.bubbleText}>{segment.text}</Text>
    </View>
  );
}

function ActionItemRow({
  item,
  onToggle,
}: {
  item: ActionItem;
  onToggle: (id: string, done: boolean) => void;
}) {
  const isDone = item.status === 'done';
  const priorityConfig: Record<string, { color: string; label: string }> = {
    high: { color: '#FF3B30', label: 'High' },
    medium: { color: '#FF9500', label: 'Med' },
    low: { color: '#AEAEB2', label: 'Low' },
  };
  const p = priorityConfig[item.priority ?? 'medium'] ?? priorityConfig.medium;

  return (
    <TouchableOpacity style={a.row} onPress={() => onToggle(item.id, !isDone)} activeOpacity={0.7}>
      <View style={[a.checkbox, isDone && a.checkboxDone]}>
        {isDone && <Text style={a.checkmark}>✓</Text>}
      </View>
      <View style={a.rowContent}>
        <Text style={[a.taskText, isDone && a.taskDone]}>{item.task}</Text>
        <View style={a.rowMeta}>
          <View style={[a.priorityBadge, { backgroundColor: p.color + '18' }]}>
            <View style={[a.priorityDot, { backgroundColor: p.color }]} />
            <Text style={[a.priorityText, { color: p.color }]}>{p.label}</Text>
          </View>
          {item.owner && (
            <View style={a.ownerBadge}>
              <Text style={a.ownerText}>{item.owner}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DecisionItem({ text, index }: { text: string; index: number }) {
  return (
    <View style={d.row}>
      <View style={d.numWrap}>
        <Text style={d.num}>{index + 1}</Text>
      </View>
      <Text style={d.text}>{text}</Text>
    </View>
  );
}

function QuestionItem({ text }: { text: string }) {
  return (
    <View style={d.row}>
      <View style={[d.numWrap, { backgroundColor: Colors.warning + '18' }]}>
        <Text style={[d.num, { color: Colors.warning }]}>?</Text>
      </View>
      <Text style={d.text}>{text}</Text>
    </View>
  );
}

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: meeting,
    isLoading: meetingLoading,
    error: meetingError,
    refetch: refetchMeeting,
  } = useQuery<Meeting | null>({
    queryKey: ['meeting', id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
  });

  const {
    data: transcripts,
    isLoading: transcriptsLoading,
    refetch: refetchTranscripts,
  } = useQuery<Transcript[]>({
    queryKey: ['transcripts', id],
    queryFn: () => getTranscriptsByMeeting(id!),
    enabled: !!id && (meeting?.status === 'done' || meeting?.status === 'analyzing'),
  });

  const {
    data: note,
    isLoading: noteLoading,
    refetch: refetchNote,
  } = useQuery<MeetingNote | null>({
    queryKey: ['meeting-note', id],
    queryFn: () => getMeetingNote(id!),
    enabled: !!id && meeting?.status === 'done',
  });

  const {
    data: actionItems,
    isLoading: actionsLoading,
    refetch: refetchActions,
  } = useQuery<ActionItem[]>({
    queryKey: ['action-items', id],
    queryFn: () => getActionItemsByMeeting(id!),
    enabled: !!id && meeting?.status === 'done',
  });

  const { data: relatedMeetings } = useQuery<Array<{ id: string; title: string; created_at: string; status: string }>>({
    queryKey: ['related-meetings', id],
    queryFn: () => getRelatedMeetings(id!),
    enabled: !!id && meeting?.status === 'done',
  });

  useFocusEffect(
    useCallback(() => {
      refetchMeeting();
      if (meeting?.status === 'done') {
        refetchTranscripts();
        refetchNote();
        refetchActions();
      }
    }, [refetchMeeting, refetchTranscripts, refetchNote, refetchActions, meeting?.status])
  );

  const handleToggleAction = async (itemId: string, done: boolean) => {
    try {
      await updateActionItemStatus(itemId, done ? 'done' : 'open');
      refetchActions();
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Meeting',
      'This will permanently delete this meeting, its transcript, analysis, action items, and knowledge graph data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setIsDeleting(true);
            try {
              await deleteMeeting(id);
              queryClient.invalidateQueries({ queryKey: ['meetings'] });
              router.replace('/');
            } catch {
              setIsDeleting(false);
              Alert.alert('Error', 'Failed to delete meeting. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditTitle = () => {
    if (!meeting) return;
    Alert.prompt(
      'Edit Title',
      'Enter a new title for this meeting',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newTitle?: string) => {
            const trimmed = newTitle?.trim();
            if (!trimmed || !id) return;
            try {
              await updateMeetingTitle(id, trimmed);
              refetchMeeting();
              queryClient.invalidateQueries({ queryKey: ['meetings'] });
            } catch {
              Alert.alert('Error', 'Failed to update title');
            }
          },
        },
      ],
      'plain-text',
      meeting.title
    );
  };

  const backButton = () => (
    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ paddingRight: 12 }}>
      <Text style={{ fontSize: 28, color: Colors.primary, fontWeight: '300' }}>‹</Text>
    </TouchableOpacity>
  );

  if (meetingLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Meeting', headerLeft: backButton }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  if (meetingError || !meeting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Meeting', headerLeft: backButton }} />
        <View style={s.center}>
          <Text style={s.errorText}>Meeting not found</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetchMeeting()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const durationText = meeting.duration_seconds
    ? `${Math.floor(meeting.duration_seconds / 60)}m ${meeting.duration_seconds % 60}s`
    : null;

  const isDone = meeting.status === 'done';
  const isAnalyzing = meeting.status === 'analyzing';

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={{ paddingRight: 12 }}>
              <Text style={{ fontSize: 28, color: Colors.primary, fontWeight: '300' }}>‹</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleEditTitle} style={{ padding: 8 }}>
              <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={s.container}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Status */}
        <Text style={s.meetingTitle}>{meeting.title}</Text>
        <StatusPill status={meeting.status} />

        {/* Info Badges */}
        <View style={s.infoRow}>
          <InfoBadge icon="📅" text={formatDate(meeting.created_at)} />
          {durationText && <InfoBadge icon="⏱️" text={durationText} />}
          <InfoBadge icon="🏢" text={meeting.meeting_type} />
        </View>

        {/* Quick Actions */}
        <View style={s.actionBar}>
          <TouchableOpacity style={s.actionBtn} onPress={handleEditTitle}>
            <Text style={s.actionBtnIcon}>✏️</Text>
            <Text style={s.actionBtnLabel}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/search`)}>
            <Text style={s.actionBtnIcon}>🔍</Text>
            <Text style={s.actionBtnLabel}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={handleDelete}>
            <Text style={s.actionBtnIcon}>🗑️</Text>
            <Text style={[s.actionBtnLabel, { color: Colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {(isDone || isAnalyzing) && (
          <>
            <SectionHeader icon="📝" title="Summary" />
            {isAnalyzing && (
              <View style={s.infoCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={s.infoText}>Generating AI summary...</Text>
              </View>
            )}
            {isDone && noteLoading && (
              <View style={s.infoCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}
            {isDone && !noteLoading && note && (
              <View style={s.summaryCard}>
                <Text style={s.summaryText}>{note.summary}</Text>
              </View>
            )}
            {isDone && !noteLoading && !note && (
              <View style={s.infoCard}>
                <Text style={s.infoText}>No summary available</Text>
              </View>
            )}
          </>
        )}

        {/* Action Items */}
        {isDone && (
          <>
            <SectionHeader icon="☑️" title="Action Items" count={actionItems?.length} />
            {actionsLoading && (
              <View style={s.infoCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )}
            {!actionsLoading && actionItems && actionItems.length > 0 && (
              <View style={a.container}>
                {actionItems.map((item) => (
                  <ActionItemRow key={item.id} item={item} onToggle={handleToggleAction} />
                ))}
              </View>
            )}
            {!actionsLoading && (!actionItems || actionItems.length === 0) && (
              <View style={s.infoCard}>
                <Text style={s.infoText}>No action items identified</Text>
              </View>
            )}
          </>
        )}

        {/* Decisions */}
        {isDone && note && (note.decisions as string[]).length > 0 && (
          <>
            <SectionHeader icon="⚡" title="Key Decisions" count={(note.decisions as string[]).length} />
            <View style={d.container}>
              {(note.decisions as string[]).map((dec, i) => (
                <DecisionItem key={i} text={dec} index={i} />
              ))}
            </View>
          </>
        )}

        {/* Open Questions */}
        {isDone && note && (note.open_questions as string[]).length > 0 && (
          <>
            <SectionHeader icon="❓" title="Open Questions" count={(note.open_questions as string[]).length} />
            <View style={d.container}>
              {(note.open_questions as string[]).map((q, i) => (
                <QuestionItem key={i} text={q} />
              ))}
            </View>
          </>
        )}

        {/* Transcript */}
        {(isDone || isAnalyzing) && transcripts && transcripts.length > 0 && (
          <>
            <TouchableOpacity
              style={s.transcriptToggle}
              onPress={() => setTranscriptExpanded(!transcriptExpanded)}
              activeOpacity={0.7}
            >
              <View style={s.sectionRow}>
                <View style={s.sectionIconWrap}>
                  <Text style={s.sectionIcon}>💬</Text>
                </View>
                <Text style={s.sectionTitle}>Transcript</Text>
              </View>
              <View style={s.expandChip}>
                <Text style={s.expandChipText}>{transcriptExpanded ? 'Hide' : 'Show'}</Text>
              </View>
            </TouchableOpacity>
            {transcriptExpanded &&
              transcripts.map((seg) => (
                <TranscriptBubble key={seg.id} segment={seg} />
              ))}
          </>
        )}

        {meeting.status === 'processing' && (
          <>
            <SectionHeader icon="💬" title="Transcript" />
            <View style={s.infoCard}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={s.infoText}>Transcribing your meeting...</Text>
            </View>
          </>
        )}

        {meeting.status === 'failed' && (
          <>
            <SectionHeader icon="💬" title="Transcript" />
            <View style={[s.infoCard, { backgroundColor: Colors.badgeFailed }]}>
              <Text style={[s.infoText, { color: Colors.danger }]}>
                Processing failed. Try recording again.
              </Text>
            </View>
          </>
        )}

        {/* Related Meetings */}
        {isDone && relatedMeetings && relatedMeetings.length > 0 && (
          <>
            <SectionHeader icon="🔗" title="Related Meetings" count={relatedMeetings.length} />
            <View style={s.relatedContainer}>
              {relatedMeetings.map((rm) => (
                <TouchableOpacity
                  key={rm.id}
                  style={s.relatedRow}
                  onPress={() => router.push(`/meeting/${rm.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={s.relatedIconWrap}>
                    <Text style={s.relatedIconText}>📋</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.relatedTitle} numberOfLines={1}>{rm.title}</Text>
                    <Text style={s.relatedDate}>{formatDate(rm.created_at)}</Text>
                  </View>
                  <Text style={s.relatedArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const t = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 12,
    ...shadow1,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleText: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 30,
    letterSpacing: 0.1,
  },
});

const a = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...shadow1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '30',
    gap: 14,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  rowContent: {
    flex: 1,
  },
  taskText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 8,
  },
  taskDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ownerBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});

const d = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...shadow1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 14,
    alignItems: 'flex-start',
  },
  numWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  num: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
});

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 56,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    marginBottom: 20,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    ...shadow2,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  meetingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Info Badges
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    ...shadow1,
  },
  infoBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBadgeEmoji: {
    fontSize: 16,
  },
  infoBadgeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    ...shadow1,
  },
  actionBtnDanger: {
    backgroundColor: Colors.badgeFailed,
  },
  actionBtnIcon: {
    fontSize: 20,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },

  // Section Headers
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 14,
  },
  expandChip: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  expandChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    ...shadow1,
  },
  summaryText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadow1,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Related
  relatedContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    ...shadow1,
  },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '30',
  },
  relatedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedIconText: {
    fontSize: 18,
  },
  relatedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  relatedDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  relatedArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '300',
  },
});
