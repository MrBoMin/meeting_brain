import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../src/constants/colors';
import { shadow1, shadow2 } from '../src/constants/shadows';

const FEATURES = [
  { icon: '🎙️', title: 'Record', desc: 'In-person or virtual meetings', color: Colors.primary },
  { icon: '🇲🇲', title: 'Transcribe', desc: 'Burmese + English support', color: Colors.accent },
  { icon: '🧠', title: 'AI Analysis', desc: 'Summaries & action items', color: '#8B5CF6' },
  { icon: '🔗', title: 'Knowledge', desc: 'Connect your thinking', color: '#FF9500' },
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🧠</Text>
          <Text style={styles.heroTitle}>MeetingBrain</Text>
          <Text style={styles.heroSubtitle}>
            Your AI-powered second brain{'\n'}for every meeting
          </Text>
        </View>

        {/* Feature Grid */}
        <Text style={styles.featuresTitle}>What you can do</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={[styles.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* How It Works */}
        <Text style={styles.featuresTitle}>How it works</Text>
        <View style={styles.stepsCard}>
          <StepRow number="1" text="Record your meeting with one tap" />
          <StepRow number="2" text="AI transcribes and analyzes automatically" />
          <StepRow number="3" text="Get summaries, action items & decisions" />
          <StepRow number="4" text="Knowledge graph connects everything" isLast />
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Record. Transcribe. Analyze. Remember.
        </Text>
      </ScrollView>
    </>
  );
}

function StepRow({ number, text, isLast }: { number: string; text: string; isLast?: boolean }) {
  return (
    <View style={[stepStyles.row, !isLast && stepStyles.rowBorder]}>
      <View style={stepStyles.numWrap}>
        <Text style={stepStyles.num}>{number}</Text>
      </View>
      <Text style={stepStyles.text}>{text}</Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '30',
  },
  numWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  num: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },

  // Hero
  heroCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    marginBottom: 32,
    ...shadow2,
  },
  heroIcon: {
    fontSize: 72,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.textOnDark,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 17,
    color: Colors.textOnDarkSecondary,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },

  // Features
  featuresTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    ...shadow1,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Steps
  stepsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 32,
    ...shadow1,
  },

  // CTA
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
