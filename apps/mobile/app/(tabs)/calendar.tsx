import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getMeetings } from '../../src/services/meetingService';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import { formatDuration } from '../../src/utils/format';
import { useOrganization } from '../../src/contexts/OrganizationContext';
import type { Meeting } from '../../src/types/database';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const STATUS_ICON: Record<string, string> = {
  done: '✅', processing: '⏳', analyzing: '🧠',
  linking: '🔗', failed: '❌', recording: '🎙️',
};

export default function CalendarScreen() {
  const router = useRouter();
  const { activeOrg } = useOrganization();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(today));

  const {
    data: meetings,
    isLoading,
    refetch,
  } = useQuery<Meeting[]>({
    queryKey: ['meetings', activeOrg?.id ?? 'personal'],
    queryFn: () => getMeetings(activeOrg?.id ?? null),
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    if (!meetings) return map;
    for (const m of meetings) {
      const key = toDateKey(new Date(m.created_at));
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return map;
  }, [meetings]);

  const selectedMeetings = meetingsByDate[selectedDate] ?? [];

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const todayKey = toDateKey(today);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDate(todayKey);
  };

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [firstDay, daysInMonth]);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.wrapper}>
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* Month Navigation */}
      <View style={s.monthCard}>
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <Text style={s.navBtnText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday}>
            <Text style={s.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <Text style={s.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={s.weekRow}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={s.weekCell}>
              <Text style={s.weekText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={s.grid}>
          {calendarDays.map((day, i) => {
            if (day === null) {
              return <View key={`empty-${i}`} style={s.dayCell} />;
            }

            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;
            const hasMeetings = !!meetingsByDate[dateKey];
            const meetingCount = meetingsByDate[dateKey]?.length ?? 0;

            return (
              <TouchableOpacity
                key={dateKey}
                style={[
                  s.dayCell,
                  isSelected && s.dayCellSelected,
                  isToday && !isSelected && s.dayCellToday,
                ]}
                onPress={() => setSelectedDate(dateKey)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.dayText,
                    isSelected && s.dayTextSelected,
                    isToday && !isSelected && s.dayTextToday,
                  ]}
                >
                  {day}
                </Text>
                {hasMeetings && (
                  <View style={s.dotRow}>
                    {meetingCount <= 3 ? (
                      Array.from({ length: meetingCount }).map((_, j) => (
                        <View
                          key={j}
                          style={[
                            s.dot,
                            isSelected && s.dotSelected,
                          ]}
                        />
                      ))
                    ) : (
                      <>
                        <View style={[s.dot, isSelected && s.dotSelected]} />
                        <View style={[s.dot, isSelected && s.dotSelected]} />
                        <View style={[s.dot, isSelected && s.dotSelected]} />
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Selected Date Header */}
      <View style={s.dateHeader}>
        <Text style={s.dateTitle}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={s.dateCount}>
          {selectedMeetings.length} meeting{selectedMeetings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Meeting List */}
      {selectedMeetings.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyText}>No meetings on this day</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push({ pathname: '/schedule', params: { date: selectedDate } })}
          >
            <Text style={s.emptyBtnText}>Schedule a Meeting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        selectedMeetings.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={s.meetingCard}
            onPress={() => router.push(`/meeting/${m.id}`)}
            activeOpacity={0.7}
          >
            <View style={s.meetingLeft}>
              <View style={s.meetingTime}>
                <Text style={s.meetingTimeText}>
                  {new Date(m.created_at).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={s.timelineBar} />
            </View>
            <View style={s.meetingContent}>
              <View style={s.meetingHeader}>
                <Text style={s.meetingTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={s.meetingStatus}>{STATUS_ICON[m.status] ?? '📋'}</Text>
              </View>
              <View style={s.meetingMeta}>
                <View style={s.metaChip}>
                  <Text style={s.metaChipText}>{m.meeting_type}</Text>
                </View>
                <Text style={s.metaDuration}>{formatDuration(m.duration_seconds)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Upcoming Summary */}
      {meetings && meetings.length > 0 && (
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>This Month</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>
                {meetings.filter((m) => {
                  const d = new Date(m.created_at);
                  return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                }).length}
              </Text>
              <Text style={s.summaryLabel}>Meetings</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>
                {(meetings
                  .filter((m) => {
                    const d = new Date(m.created_at);
                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                  })
                  .reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0) / 3600
                ).toFixed(1)}h
              </Text>
              <Text style={s.summaryLabel}>Recorded</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>
                {meetings.filter((m) => {
                  const d = new Date(m.created_at);
                  return d.getMonth() === currentMonth && d.getFullYear() === currentYear && m.status === 'done';
                }).length}
              </Text>
              <Text style={s.summaryLabel}>Completed</Text>
            </View>
          </View>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>

    {/* FAB */}
    <TouchableOpacity
      style={s.fab}
      onPress={() => router.push({ pathname: '/schedule', params: { date: selectedDate } })}
      activeOpacity={0.85}
    >
      <Text style={s.fabIcon}>+</Text>
    </TouchableOpacity>
  </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Month Card
  monthCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 24,
    padding: 20,
    ...shadow2,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 24,
    color: Colors.textPrimary,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  // Weekday
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    backgroundColor: Colors.primarySoft,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '800',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  dotSelected: {
    backgroundColor: '#fff',
  },

  // Date Header
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  dateCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    backgroundColor: Colors.border + '60',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Empty State
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 36,
    marginHorizontal: 16,
    alignItems: 'center',
    ...shadow1,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Meeting Card (timeline style)
  meetingCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    ...shadow1,
  },
  meetingLeft: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingLeft: 16,
    width: 72,
  },
  meetingTime: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  meetingTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  timelineBar: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 8,
    borderRadius: 1,
  },
  meetingContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  meetingStatus: {
    fontSize: 16,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaChip: {
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'capitalize',
  },
  metaDuration: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Monthly Summary
  summaryCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 12,
    ...shadow2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textOnDark,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textOnDark,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textOnDarkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
});
