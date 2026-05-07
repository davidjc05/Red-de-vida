import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { login } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Rellena todos los campos');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      const role = await AsyncStorage.getItem('role');
      if (role === 'admin') {
        router.replace('/(tabs)/calendar');
      } else {
        router.replace('/(tabs)/calendar');
      }
    } catch (e: any) {
      Alert.alert('Error de acceso', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero verde */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>🏋️</Text>
          </View>
          <Text style={styles.appName}>Red de vida</Text>
          <Text style={styles.appSub}>Te ayudamos a mejorar</Text>
        </View>

        {/* Tarjeta formulario */}
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenido de nuevo</Text>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          {/* Contraseña con toggle */}
          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Olvidé contraseña */}
          <TouchableOpacity style={styles.forgotWrap}>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Botón principal */}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          {/* Divisor */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continúa con</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Acceso social */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              activeOpacity={0.75}
              onPress={() => Alert.alert('Próximamente', 'Acceso con Google en desarrollo')}
            >
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialBtn}
              activeOpacity={0.75}
              onPress={() => Alert.alert('Próximamente', 'Acceso con Apple en desarrollo')}
            >
              <Text style={styles.socialIcon}></Text>
              <Text style={styles.socialText}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Registro */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scroll: {
    flexGrow: 1,
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 36,
    backgroundColor: Colors.primary,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoIcon: { fontSize: 32 },
  appName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 0.3,
  },
  appSub: {
    fontSize: 13,
    color: Colors.primaryMid,
    marginTop: 5,
  },

  /* Tarjeta */
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 24,
  },

  /* Campos */
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 7,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 18,
  },

  /* Password con ojo */
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    marginBottom: 10,
    paddingRight: 14,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },

  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 22,
    marginTop: 4,
  },
  forgot: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },

  /* Botón */
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 22,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Divisor */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  /* Social */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 13,
    backgroundColor: Colors.surface,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  /* Hint registro */
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  hintLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
});