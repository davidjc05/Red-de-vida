import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../constants/legal';

export default function PrivacyScreen() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Text style={s.backText}>‹ Volver</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.title}>Política de privacidad</Text>
          <Text style={s.updated}>Última actualización: {PRIVACY_UPDATED}</Text>
          {PRIVACY_SECTIONS.map(sec => (
            <View key={sec.title} style={s.section}>
              <Text style={s.sectionTitle}>{sec.title}</Text>
              <Text style={s.body}>{sec.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { fontSize: 16, color: Colors.primary, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  updated: { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginBottom: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
});
