import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { register, login } from '../../services/api';

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: Colors.border };
  if (pw.length < 6)   return { level: 1, label: 'Muy débil', color: Colors.error };
  if (pw.length < 8)   return { level: 2, label: 'Débil', color: '#E87B30' };
  const strong = /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  const medium = /[A-Z]/.test(pw) || /[0-9]/.test(pw);
  if (strong)  return { level: 4, label: 'Fuerte', color: Colors.primary };
  if (medium)  return { level: 3, label: 'Aceptable', color: '#639922' };
  return { level: 2, label: 'Débil', color: '#E87B30' };
}

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showPw2, setShowPw2]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password2.length > 0 && password === password2;
  const passwordsMismatch = password2.length > 0 && password !== password2;

  async function handleRegister() {
    if (!name || !email || !password || !password2) {
      Alert.alert('Error', 'Rellena todos los campos');
      return;
    }
    if (password !== password2) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      await login(email.trim(), password);
      router.replace('/(tabs)/routines');
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Empieza gratis hoy</Text>
        </View>

        {/* Formulario */}
        <View style={styles.card}>

          {/* Nombre */}
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />

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

          {/* Contraseña + fortaleza */}
          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPw(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Barra fortaleza */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i <= strength.level ? strength.color : Colors.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {/* Repetir contraseña */}
          <Text style={[styles.label, { marginTop: 18 }]}>Repetir contraseña</Text>
          <View style={[
            styles.passwordRow,
            passwordsMismatch && styles.inputError,
            passwordsMatch   && styles.inputSuccess,
          ]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Repite tu contraseña"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPw2}
              value={password2}
              onChangeText={setPassword2}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPw2(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.eyeIcon}>{showPw2 ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {passwordsMismatch && (
            <Text style={styles.errorText}>Las contraseñas no coinciden</Text>
          )}
          {passwordsMatch && (
            <Text style={styles.successText}>✓ Las contraseñas coinciden</Text>
          )}

          {/* Botón */}
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled, { marginTop: 28 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          {/* Hint login */}
          <View style={styles.hintRow}>
            <Text style={styles.hint}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.hintLink}>Inicia sesión</Text>
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
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },

  /* Cabecera */
  header: { marginBottom: 28 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20 },
  back: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 5,
  },

  /* Tarjeta */
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

  /* Password */
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingRight: 14,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  inputError: {
    borderColor: Colors.error,
  },
  inputSuccess: {
    borderColor: Colors.primary,
  },

  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 5,
  },
  successText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 5,
  },

  /* Barra fortaleza */
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 99,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 64,
    textAlign: 'right',
  },

  /* Botón */
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Hint */
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