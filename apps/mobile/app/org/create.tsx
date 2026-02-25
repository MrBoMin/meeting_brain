import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { shadow1, shadow2 } from '../../src/constants/shadows';
import { useAuth } from '../../src/hooks/useAuth';
import { useOrganization } from '../../src/contexts/OrganizationContext';
import { createOrganization } from '../../src/services/organizationService';

const ICONS = ['🏢', '🏠', '💼', '🎯', '🚀', '🌟', '📊', '🧪', '🎓', '👥', '🌍', '💡'];
const COLORS = [
  '#5B4CFF', '#00BFA6', '#FF6B6B', '#FF9500',
  '#34C759', '#007AFF', '#AF52DE', '#FF2D55',
  '#5856D6', '#32ADE6', '#FFD60A', '#FF375F',
];

export default function CreateOrgScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useOrganization();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [color, setColor] = useState('#5B4CFF');
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    setIsSaving(true);
    try {
      await createOrganization({ name: name.trim(), description: description.trim() || null, icon, color }, user.id);
      await refresh();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create organization');
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'New Organization' }} />
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>
        {/* Preview */}
        <View style={[s.previewCard, { backgroundColor: color }]}>
          <Text style={s.previewIcon}>{icon}</Text>
          <Text style={s.previewName}>{name || 'Organization Name'}</Text>
          <Text style={s.previewDesc}>{description || 'Your team workspace'}</Text>
        </View>

        {/* Name */}
        <View style={s.fieldCard}>
          <Text style={s.fieldLabel}>Name</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. Engineering Team"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Description */}
        <View style={s.fieldCard}>
          <Text style={s.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            placeholder="What's this organization about?"
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Icon Picker */}
        <Text style={s.sectionTitle}>Icon</Text>
        <View style={s.iconGrid}>
          {ICONS.map((ic) => (
            <TouchableOpacity
              key={ic}
              style={[s.iconCell, icon === ic && s.iconCellActive]}
              onPress={() => setIcon(ic)}
            >
              <Text style={s.iconText}>{ic}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Color Picker */}
        <Text style={s.sectionTitle}>Color</Text>
        <View style={s.colorGrid}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[s.colorCell, { backgroundColor: c }, color === c && s.colorCellActive]}
              onPress={() => setColor(c)}
            >
              {color === c && <Text style={s.colorCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[s.createBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.createBtnText}>Create Organization</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, paddingBottom: 48 },

  previewCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    ...shadow2,
  },
  previewIcon: { fontSize: 48, marginBottom: 12 },
  previewName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4, textAlign: 'center' },
  previewDesc: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center' },

  fieldCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
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
  input: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, paddingVertical: 4 },
  inputMulti: { minHeight: 60, textAlignVertical: 'top', fontSize: 15, fontWeight: '500', lineHeight: 22 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  iconCell: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow1,
  },
  iconCellActive: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  iconText: { fontSize: 26 },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  colorCell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCellActive: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  colorCheck: { color: '#fff', fontSize: 18, fontWeight: '800' },

  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  createBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
