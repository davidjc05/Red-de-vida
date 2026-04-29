import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { login,getMe } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Rellena todos los campos');
      return;
    }

    setLoading(true);

    try {
      const data = await login(email.trim(), password);


      const me = await getMe();

      console.log("ROLE GUARDADO:", me.role);

      if (me.role === 'admin') {
        router.replace('/(tabs)/routines');
      } else {
        router.replace('/(tabs)/exercises');
      }

    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🏋️</Text>
          </View>
          <Text style={styles.appName}>GymAPI</Text>
          <Text style={styles.appSub}>Tu entrenamiento, bajo control</Text>
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenido de nuevo</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          <View style={styles.hintRow}>
            <Text style={styles.hint}>¿Sin cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.hintLink}>Regístrate gratis</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  hero: { alignItems: 'center', marginBottom: 32 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoIcon: { fontSize: 32 },
  appName: { fontSize: 24, fontWeight: '600', color: Colors.textPrimary },
  appSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 20 },

  label: {
    fontSize: 12, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 15, fontSize: 16,
    color: Colors.textPrimary, marginBottom: 16,
  },

  forgot: {
    fontSize: 13, color: Colors.primary,
    textAlign: 'right', marginBottom: 20,
  },

  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  hintRow: { flexDirection: 'row', justifyContent: 'center' },
  hint: { fontSize: 14, color: Colors.textMuted },
  hintLink: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});