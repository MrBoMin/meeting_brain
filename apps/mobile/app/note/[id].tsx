import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../src/constants/colors';

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Note' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Note Editor</Text>
        <Text style={styles.subtitle}>
          Manual note creation linked to the knowledge graph
        </Text>
        {/* TODO: Phase 3 — rich text editor with knowledge graph linking */}
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
