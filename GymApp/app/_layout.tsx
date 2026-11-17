import { Stack } from 'expo-router';
import { View } from 'react-native';
import ServerWakeBanner from '@/components/ServerWakeBanner';

export default function AuthLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <ServerWakeBanner />
    </View>
  );
}
