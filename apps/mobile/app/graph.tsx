import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../src/constants/colors';

export default function GraphScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Knowledge Graph' }} />
      <View style={styles.container}>
        <Text style={styles.icon}>🧠</Text>
        <Text style={styles.title}>Knowledge Graph</Text>
        <Text style={styles.subtitle}>
          Your meeting connections will be visualized here as an interactive
          neural dot graph
        </Text>
        {/* TODO: Phase 3 — react-native-svg interactive graph visualization */}
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
  },
});
