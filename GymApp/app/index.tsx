import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { getToken, getMe, getRole, homeFor } from '../services/api';
import { storage } from '../services/storage';
import { Colors } from '../constants/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const token = await getToken();

      // Sin token: directo al login
      if (!token) {
        router.replace('/auth/login');
        return;
      }

      try {
        // Se valida el token contra el backend y se usa el rol que devuelve el servidor
        const me = await getMe();
        await storage.setItem('role', me.role);
        router.replace(homeFor(me.role));
      } catch {
        // Si el servidor respondió 401, authFetch ya borró el token → login.
        // Si fue un fallo de red, el token sigue ahí y se entra con el último rol guardado.
        if (!(await getToken())) {
          router.replace('/auth/login');
          return;
        }
        router.replace(homeFor(await getRole()));
      }
    }

    check();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
