import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getMeetingById } from '../../src/services/meetingService';
import { triggerTranscription, triggerAnalysis, triggerLinking } from '../../src/services/storageService';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import type { MeetingStatus } from '../../src/types/database';

const STEPS: { key: MeetingStatus; icon: string; label: string }[] = [
  { key: 'processing', icon: '🎙️', label: 'Transcribe' },
  { key: 'analyzing',  icon: '🧠', label: 'Analyze' },
  { key: 'linking',    icon: '🔗', label: 'Link' },
  { key: 'done',       icon: '✅', label: 'Done' },
];

const STATUS_ORDER: Record<string, number> = {
  recording: -1,
  processing: 0,
  analyzing: 1,
  linking: 2,
  done: 3,
  failed: -2,
};

const STATUS_LABELS: Record<MeetingStatus, string> = {
  recording: 'Finishing recording...',
  processing: 'Transcribing your meeting...',
  analyzing: 'Analyzing with AI...',
  linking: 'Building knowledge graph...',
  done: 'All done!',
  failed: 'Processing failed',
};

function StepIndicator({ status }: { status: MeetingStatus }) {
  const currentIdx = STATUS_ORDER[status] ?? 0;

  return (
    <View style={step.container}>
      {STEPS.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx || status === 'done';
        return (
          <View key={s.key} style={step.item}>
            {i > 0 && (
              <View style={[step.line, isDone && step.lineDone]} />
            )}
            <View
              style={[
                step.circle,
                isDone && step.circleDone,
                isActive && step.circleActive,
              ]}
            >
              <Text style={step.circleIcon}>{isDone && !isActive ? '✓' : s.icon}</Text>
            </View>
            <Text style={[step.label, (isActive || isDone) && step.labelActive]}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const transcriptionTriggered = useRef(false);
  const analysisTriggered = useRef(false);
  const linkingTriggered = useRef(false);

  const { data: meeting, error } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'done' || status === 'failed') return false;
      return 3000;
    },
  });

  const doTranscribe = useCallback(async () => {
    if (!id || transcriptionTriggered.current) return;
    transcriptionTriggered.current = true;
    try {
      await triggerTranscription(id);
    } catch {
      transcriptionTriggered.current = false;
    }
  }, [id]);

  const doAnalyze = useCallback(async () => {
    if (!id || analysisTriggered.current) return;
    analysisTriggered.current = true;
    try {
      await triggerAnalysis(id);
    } catch {
      analysisTriggered.current = false;
    }
  }, [id]);

  const doLink = useCallback(async () => {
    if (!id || linkingTriggered.current) return;
    linkingTriggered.current = true;
    try {
      await triggerLinking(id);
    } catch {
      linkingTriggered.current = false;
    }
  }, [id]);

  useEffect(() => {
    if (meeting?.status === 'processing' && !transcriptionTriggered.current) {
      doTranscribe();
    }
  }, [meeting?.status, doTranscribe]);

  useEffect(() => {
    if (meeting?.status === 'analyzing' && !analysisTriggered.current) {
      doAnalyze();
    }
  }, [meeting?.status, doAnalyze]);

  useEffect(() => {
    if (meeting?.status === 'linking' && !linkingTriggered.current) {
      doLink();
    }
  }, [meeting?.status, doLink]);

  useEffect(() => {
    if (meeting?.status === 'done') {
      const timer = setTimeout(() => {
        router.replace(`/meeting/${id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [meeting?.status, id, router]);

  const status = meeting?.status ?? 'processing';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Processing',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ paddingRight: 12 }}>
              <Text style={{ fontSize: 28, color: Colors.primary, fontWeight: '300' }}>‹</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.card}>
          {/* Step Progress */}
          <StepIndicator status={status} />

          {/* Main Content */}
          <View style={styles.contentArea}>
            <Text style={styles.statusIcon}>
              {status === 'done' ? '✅' : status === 'failed' ? '❌' : status === 'analyzing' ? '🧠' : status === 'linking' ? '🔗' : '🎙️'}
            </Text>

            {status !== 'done' && status !== 'failed' && (
              <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
            )}

            <Text style={styles.title}>{STATUS_LABELS[status]}</Text>

            {status === 'processing' && (
              <Text style={styles.subtitle}>
                This may take a minute depending on the length of your meeting
              </Text>
            )}
            {status === 'analyzing' && (
              <Text style={styles.subtitle}>
                Extracting summary, action items, and key decisions...
              </Text>
            )}
            {status === 'linking' && (
              <Text style={styles.subtitle}>
                Connecting this meeting to your knowledge graph...
              </Text>
            )}
            {status === 'done' && (
              <Text style={styles.subtitle}>Redirecting to your meeting...</Text>
            )}
          </View>

          {status === 'failed' && (
            <View style={styles.failedActions}>
              <Text style={styles.failedHint}>
                Something went wrong during transcription.{'\n'}
                Please try again.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  transcriptionTriggered.current = false;
                  doTranscribe();
                }}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.secondaryText}>Go Home</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <Text style={styles.errorText}>Could not check status. Retrying...</Text>
          )}
        </View>
      </View>
    </>
  );
}

const step = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 36,
    paddingHorizontal: 4,
  },
  item: {
    alignItems: 'center',
    flex: 1,
  },
  line: {
    position: 'absolute',
    top: 20,
    left: -20,
    right: 20,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    zIndex: -1,
  },
  lineDone: {
    backgroundColor: Colors.accent,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  circleDone: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  circleActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  circleIcon: {
    fontSize: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    ...shadow2,
  },
  contentArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  failedActions: {
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  failedHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 16,
    ...shadow1,
  },
  secondaryText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: Colors.warning,
    marginTop: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
