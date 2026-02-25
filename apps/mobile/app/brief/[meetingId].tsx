import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/colors';

export default function PreBriefScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Pre-Meeting Brief' }} />
      <View style={styles.container}>
        <Text style={styles.icon}>📋</Text>
        <Text style={styles.title}>Pre-Meeting Brief</Text>
        <Text style={styles.subtitle}>
          AI-generated context from your knowledge graph — open action items,
          last decisions, and attendee context
        </Text>
        {/* TODO: Phase 5 — calendar integration + knowledge graph query + Claude brief */}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
