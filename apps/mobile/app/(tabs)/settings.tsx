import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { shadow1 } from '../../src/constants/shadows';
import { useAuth } from '../../src/hooks/useAuth';
import { signOut } from '../../src/services/authService';
import { SUPPORTED_LANGUAGES } from '../../src/constants/languages';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch {
            setIsSigningOut(false);
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Account</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>Email</Text>
              <Text style={s.rowValue}>{user?.email ?? 'Not signed in'}</Text>
            </View>
            <View style={s.separator} />
            <View style={s.row}>
              <Text style={s.rowLabel}>User ID</Text>
              <Text style={[s.rowValue, { fontSize: 11 }]} numberOfLines={1}>
                {user?.id ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Supported Languages</Text>
          <View style={s.card}>
            {SUPPORTED_LANGUAGES.map((lang, i) => (
              <React.Fragment key={lang.code}>
                {i > 0 && <View style={s.separator} />}
                <View style={s.row}>
                  <Text style={s.rowLabel}>{lang.nativeLabel}</Text>
                  <Text style={s.rowValue}>{lang.code}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <Text style={s.hint}>
            You can select the recording language on the record screen
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>About</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowLabel}>App</Text>
              <Text style={s.rowValue}>MeetingBrain</Text>
            </View>
            <View style={s.separator} />
            <View style={s.row}>
              <Text style={s.rowLabel}>Version</Text>
              <Text style={s.rowValue}>1.0.0</Text>
            </View>
            <View style={s.separator} />
            <View style={s.row}>
              <Text style={s.rowLabel}>AI Model</Text>
              <Text style={s.rowValue}>Gemini 2.5 Flash</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={s.signOutBtn}
          onPress={handleSignOut}
          disabled={isSigningOut}
          activeOpacity={0.7}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <Text style={s.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 56,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    ...shadow1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border + '30',
    marginLeft: 20,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    maxWidth: '55%',
    textAlign: 'right',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
    marginLeft: 4,
    fontWeight: '500',
  },
  signOutBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.danger + '0A',
    alignItems: 'center',
    ...shadow1,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger,
  },
});
