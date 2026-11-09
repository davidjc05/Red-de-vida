import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, ImageBackground, TextInputProps,
} from 'react-native';

const GREEN = '#3B6D11';

// Marco común de las pantallas de verificación y recuperación (mismo fondo que el login)
export function AuthShell({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <ImageBackground
      source={require('../assets/images/fondoLoginyRegistro.webp')}
      style={s.bg}
      resizeMode="cover"
    >
      <View style={s.overlay} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.title}>{title}</Text>
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

export function AuthInput(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[s.input, style]}
        placeholderTextColor="rgba(59,109,17,0.45)"
      />
    </View>
  );
}

export function AuthButton({ text, onPress, loading, secondary }: {
  text: string; onPress: () => void; loading?: boolean; secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.btn, secondary && s.btnSecondary, loading && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color={secondary ? GREEN : '#fff'} />
        : <Text style={[s.btnText, secondary && { color: GREEN }]}>{text}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.15)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(234,243,222,0.95)', borderRadius: 24, padding: 22,
  },
  title: { fontSize: 24, fontWeight: '800', color: GREEN, marginBottom: 6 },
  subtitle: { fontSize: 14, color: GREEN, opacity: 0.8, marginBottom: 18, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: GREEN, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 16, color: GREEN, fontWeight: '500',
  },
  btn: { backgroundColor: GREEN, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: GREEN },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
