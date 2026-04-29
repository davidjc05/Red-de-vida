import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useEffect, useState } from 'react';
import { getMe } from '../../services/api';

export default function TabsLayout() {
  const [user, setUser] = useState<any | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  const isAdmin = user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />

      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Ejercicios',
          tabBarIcon: () => <TabIcon label="💪" />,
        }}
      />

      <Tabs.Screen
        name="routines"
        options={{
          title: 'Rutinas',
          tabBarIcon: () => <TabIcon label="🏋️" />,
          href: isAdmin ? '/(tabs)/routines' : null,
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label }: { label: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}