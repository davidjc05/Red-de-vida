import { Tabs, Redirect, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useEffect, useState } from 'react';
import { getMe, getToken, setOnUnauthorized } from '../../services/api';

import {
  House,
  CalendarDays,
  Dumbbell,
  Repeat,
} from 'lucide-react-native';

export default function TabsLayout() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  // Si con la app abierta alguna petición recibe un 401, se vuelve al login
  useEffect(() => {
    setOnUnauthorized(() => router.replace('/auth/login'));
    return () => setOnUnauthorized(null);
  }, []);

  // Puerta de entrada: cualquier camino hacia las pestañas pasa por aquí
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(async () => {
        // Sin token (o rechazado, que authFetch ya borró) → login.
        // Si solo falló la red, el token sigue y se deja entrar.
        if (!(await getToken())) setLoggedOut(true);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (loggedOut) return <Redirect href="/auth/login" />;

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
