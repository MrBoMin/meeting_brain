import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { shadow1, shadow2 } from '../src/constants/shadows';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../src/constants/languages';
import type { LanguageCode } from '../src/types/database';

const MEETING_TYPES = [
  { key: 'in-person', icon: '🏢', label: 'In-Person' },
  { key: 'virtual', icon: '💻', label: 'Virtual' },
  { key: 'phone', icon: '📞', label: 'Phone' },
  { key: 'hybrid', icon: '🔄', label: 'Hybrid' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();

  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('in-person');
  const [language, setLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  const selectedDate = params.date
    ? new Date(params.date + 'T12:00:00')
    : new Date();

  const dateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleStartRecording = () => {
    router.replace({
      pathname: '/record',
      params: {
        prefillTitle: title.trim() || undefined,
        prefillType: meetingType,
        prefillLang: language,
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Schedule Meeting' }} />
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>
        {/* Date Card */}
        <View style={s.dateCard}>
          <Text style={s.dateIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.dateLabel}>Scheduled for</Text>
            <Text style={s.dateValue}>{dateLabel}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.fieldCard}>
          <Text style={s.fieldLabel}>Meeting Title</Text>
          <TextInput
            style={s.input}
            placeholder="What's this meeting about?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Meeting Type Grid */}
        <Text style={s.sectionTitle}>Meeting Type</Text>
        <View style={s.typeGrid}>
          {MEETING_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeCard, meetingType === t.key && s.typeCardActive]}
              onPress={() => setMeetingType(t.key)}
            >
              <View style={[s.typeIconWrap, meetingType === t.key && s.typeIconWrapActive]}>
                <Text style={s.typeIcon}>{t.icon}</Text>
              </View>
              <Text style={[s.typeLabel, meetingType === t.key && s.typeLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Language */}
        <Text style={s.sectionTitle}>Language</Text>
        <View style={s.langRow}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[s.langCard, language === l.code && s.langCardActive]}
              onPress={() => setLanguage(l.code)}
            >
              <Text style={[s.langText, language === l.code && s.langTextActive]}>
                {l.nativeLabel}
              </Text>
              <Text style={[s.langCode, language === l.code && s.langCodeActive]}>
                {l.code}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start Recording Button */}
        <TouchableOpacity style={s.createBtn} onPress={handleStartRecording}>
          <Text style={s.createBtnText}>🎙️  Start Recording</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          Pre-fill your meeting details and jump straight to recording
        </Text>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },

  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    marginBottom: 20,
    ...shadow2,
  },
  dateIcon: {
    fontSize: 32,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textOnDarkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textOnDark,
    marginTop: 2,
  },

  fieldCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    ...shadow1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  typeCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    ...shadow1,
  },
  typeCardActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  typeIcon: {
    fontSize: 24,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typeLabelActive: {
    color: '#fff',
  },

  langRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  langCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    ...shadow1,
  },
  langCardActive: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  langText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  langTextActive: {
    color: '#fff',
  },
  langCode: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  langCodeActive: {
    color: 'rgba(255,255,255,0.7)',
  },

  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  hint: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
});
