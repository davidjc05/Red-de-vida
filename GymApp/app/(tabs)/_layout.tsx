import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useEffect, useState } from 'react';
import { getMe } from '../../services/api';

import {
  House,
  CalendarDays,
  Dumbbell,
  Repeat,
} from 'lucide-react-native';

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

        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#777777',

        tabBarStyle: {
          height: 78,

          backgroundColor: '#FFFFFF',

          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,

          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: '#DADADA',

          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.08,
          shadowRadius: 10,

          elevation: 10,

          paddingTop: 8,
          paddingBottom: 10,

          overflow: 'hidden',
        },

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color }) => (
            <CalendarDays size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Ejercicios',
          tabBarIcon: ({ color }) => (
            <Dumbbell size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title: 'Actividad',
        }}
      />

      <Tabs.Screen
        name="routines"
        options={{
          title: 'Rutinas',
          href: isAdmin ? '/(tabs)/routines' : null,

          tabBarIcon: ({ color }) => (
            <Repeat size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
    </Tabs>
  );
}