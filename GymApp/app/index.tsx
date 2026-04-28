import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getToken } from '../services/api';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const token = await getToken();
      if (token) {
        router.replace('/(tabs)/routines');
      } else {
        router.replace('/auth/login');
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