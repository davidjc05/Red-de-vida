import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { subscribeWaking } from '@/services/serverStatus';

// Aviso mientras el servidor gratuito despierta (primera petición tras un rato sin uso)
export default function ServerWakeBanner() {
  const [waking, setWaking] = useState(false);

  useEffect(() => subscribeWaking(setWaking), []);

  if (!waking) return null;

  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={s.box}>
        <ActivityIndicator size="small" color="#3B6D11" />
        <Text style={s.text}>
          Despertando el servidor… la primera vez puede tardar hasta un minuto.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAF3DE',
    borderColor: '#3B6D11',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 520,
  },
  text: { color: '#27500A', fontSize: 13, flexShrink: 1 },
});
