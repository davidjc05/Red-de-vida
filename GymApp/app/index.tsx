import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getToken } from '../services/api';
import { storage } from '../services/storage';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const token = await getToken();
      const role = await storage.getItem('role');
      console.log("TOKEN:", token);
      console.log("ROLE:", role);

      if (!token) {
        router.replace('/auth/login');
        return;
      }

      if (role === 'admin') {
        router.replace('/(tabs)/routines');
      } else {
        router.replace('/(tabs)/calendar');
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