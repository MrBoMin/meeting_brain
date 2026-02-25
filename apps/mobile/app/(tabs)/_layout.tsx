import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.navigate('/')} style={styles.backBtn}>
      <Text style={styles.backArrow}>‹</Text>
      <Text style={styles.backText}>Home</Text>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerLeft: () => <BackButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="📅" label="Calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'New Recording',
          headerLeft: () => <BackButton />,
          tabBarIcon: ({ focused }) => (
            <View style={styles.recordTab}>
              <View style={[styles.recordCircle, focused && styles.recordCircleActive]}>
                <Text style={styles.recordIcon}>🎙️</Text>
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerLeft: () => <BackButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔍" label="Search" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerLeft: () => <BackButton />,
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="⚙️" label="Settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 8,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.primary,
    fontWeight: '300',
    marginTop: -2,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 2,
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 0,
    height: 88,
    paddingBottom: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  recordTab: {
    alignItems: 'center',
    marginTop: -20,
  },
  recordCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  recordCircleActive: {
    backgroundColor: Colors.primary,
  },
  recordIcon: {
    fontSize: 26,
  },
});
