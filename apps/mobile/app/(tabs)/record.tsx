import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2, shadow3 } from '../../src/constants/shadows';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../../src/constants/languages';
import { formatTimer } from '../../src/utils/format';
import { useRecording } from '../../src/hooks/useRecording';
import { useAuth } from '../../src/hooks/useAuth';
import { useOrganization } from '../../src/contexts/OrganizationContext';
import { createMeeting, updateMeetingStatus } from '../../src/services/meetingService';
import { uploadMeetingAudio } from '../../src/services/storageService';
import type { LanguageCode } from '../../src/types/database';

const WAVE_BARS = 24;

function WaveformBars({ active }: { active: boolean }) {
  const anims = useRef(
    Array.from({ length: WAVE_BARS }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (active) {
      const animations = anims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.7,
              duration: 300 + Math.random() * 400,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.15 + Math.random() * 0.25,
              duration: 300 + Math.random() * 400,
              useNativeDriver: false,
            }),
          ])
        )
      );
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
    } else {
      anims.forEach((a) => a.setValue(0.3));
    }
  }, [active, anims]);

  return (
    <View style={styles.waveContainer}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 40],
              }),
              backgroundColor: active ? Colors.danger : Colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function RecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillTitle?: string; prefillType?: string; prefillLang?: string }>();
  const { user } = useAuth();
  const { activeOrg } = useOrganization();
  const { isRecording, duration, startRecording, stopRecording } = useRecording();

  const [title, setTitle] = useState(params.prefillTitle ?? '');
  const [language, setLanguage] = useState<LanguageCode>((params.prefillLang as LanguageCode) ?? DEFAULT_LANGUAGE);
  const [isSaving, setIsSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      Alert.alert('Recording Error', message);
    }
  };

  const handleStopRecording = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be signed in to save recordings');
      return;
    }

    setIsSaving(true);
    try {
      const { uri, durationSeconds } = await stopRecording();
      const meetingTitle = title.trim() || `Meeting ${new Date().toLocaleDateString()}`;

      let meeting;
      try {
        meeting = await createMeeting({
          user_id: user.id,
          title: meetingTitle,
          meeting_type: 'in-person',
          language_code: language,
          organization_id: activeOrg?.id ?? null,
        });
      } catch (e: any) {
        throw new Error(`Create meeting failed: ${e?.message ?? JSON.stringify(e)}`);
      }

      try {
        await uploadMeetingAudio(user.id, meeting.id, uri);
      } catch (e: any) {
        throw new Error(`Upload audio failed: ${e?.message ?? JSON.stringify(e)}`);
      }

      await updateMeetingStatus(meeting.id, 'processing', {
        duration_seconds: durationSeconds,
        ended_at: new Date().toISOString(),
      });

      router.replace(`/processing/${meeting.id}`);
    } catch (err: any) {
      console.error('Save recording error:', err);
      const message = err?.message ?? JSON.stringify(err);
      Alert.alert('Save Error', message);
      setIsSaving(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  if (isSaving) {
    return (
      <>
        <View style={styles.savingContainer}>
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.savingText}>Uploading recording...</Text>
            <Text style={styles.savingHint}>This may take a moment</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Title Input */}
        <View style={styles.titleCard}>
          <Text style={styles.titleLabel}>Meeting Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="What's this meeting about?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            editable={!isRecording}
          />
        </View>

        {/* Recording Area — accent dark card */}
        <View style={styles.recordCard}>
          <Text style={styles.timerLabel}>
            {isRecording ? 'Recording in progress' : 'Ready to record'}
          </Text>
          <Text style={[styles.timer, isRecording && styles.timerActive]}>
            {formatTimer(duration)}
          </Text>

          {/* Waveform */}
          <WaveformBars active={isRecording} />

          {/* Record Button */}
          <View style={styles.recordBtnWrapper}>
            {isRecording && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
            )}
            <TouchableOpacity
              style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
              onPress={handleToggleRecording}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.recordBtnInner,
                  isRecording && styles.recordBtnInnerActive,
                ]}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.recordHint}>
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
          </Text>
        </View>

        {/* Language Selector */}
        <View style={styles.langSection}>
          <Text style={styles.langTitle}>Language</Text>
          <View style={styles.langRow}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langCard, language === lang.code && styles.langCardActive]}
                onPress={() => !isRecording && setLanguage(lang.code)}
              >
                <Text style={[styles.langCardText, language === lang.code && styles.langCardTextActive]}>
                  {lang.nativeLabel}
                </Text>
                <Text style={[styles.langCardCode, language === lang.code && styles.langCardCodeActive]}>
                  {lang.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  savingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  savingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    ...shadow2,
  },
  savingText: {
    marginTop: 20,
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  savingHint: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Title Card
  titleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadow1,
  },
  titleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingVertical: 4,
  },

  // Recording Card
  recordCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    ...shadow2,
  },
  timerLabel: {
    fontSize: 14,
    color: Colors.textOnDarkSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  timer: {
    fontSize: 64,
    fontWeight: '100',
    color: Colors.textOnDark,
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
  },
  timerActive: {
    color: Colors.danger,
  },

  // Waveform
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 3,
    marginBottom: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },

  // Record Button
  recordBtnWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  recordBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  recordBtnActive: {
    borderColor: Colors.danger,
  },
  recordBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.danger,
  },
  recordBtnInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  recordHint: {
    fontSize: 14,
    color: Colors.textOnDarkSecondary,
    fontWeight: '500',
  },

  // Language
  langSection: {
    marginBottom: 20,
  },
  langTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  langRow: {
    flexDirection: 'row',
    gap: 12,
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
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  langCardText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  langCardTextActive: {
    color: '#fff',
  },
  langCardCode: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  langCardCodeActive: {
    color: 'rgba(255,255,255,0.7)',
  },
});
