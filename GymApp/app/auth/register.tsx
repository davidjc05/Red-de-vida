import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ImageBackground, Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { register, login } from '../../services/api';

const { width, height } = Dimensions.get('window');

const GREEN = '#3B6D11';
const GREEN_LIGHT = 'rgba(234,243,222,0.92)';

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: '', color: 'transparent' };
  if (pw.length < 6)   return { level: 1, label: 'Muy débil', color: '#EF4444' };
  if (pw.length < 8)   return { level: 2, label: 'Débil', color: '#E87B30' };
  const strong = /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  const medium = /[A-Z]/.test(pw) || /[0-9]/.test(pw);
  if (strong) return { level: 4, label: 'Fuerte', color: GREEN };
  if (medium) return { level: 3, label: 'Aceptable', color: '#639922' };
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
  const passwordsMatch   = password2.length > 0 && password === password2;
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
        Alert.alert(
          '¡Revisa tu correo! 📧',
          'Te hemos enviado un enlace de confirmación. Confírmalo antes de iniciar sesión.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground
      source={require('../../assets/images/fondoLoginyRegistro.png')}
      style={s.bg}
      resizeMode="cover"
    >
      <View style={s.overlay} />

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── LOGO + VOLVER ── */}
          <View style={s.logoSection}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backText}>← Volver</Text>
            </TouchableOpacity>
            <Image
              source={require('../../assets/images/logotipo.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.subtitle}>Empieza gratis hoy</Text>
          </View>

          {/* ── FORMULARIO ── */}
          <View style={s.formSection}>

            {/* NOMBRE */}
            <Text style={s.fieldLabel}>Nombre</Text>
            <View style={s.inputWrap}>
              <Text style={s.inputIcon}>👤</Text>
              <TextInput
                style={s.input}
                placeholder="Tu nombre"
                placeholderTextColor="rgba(59,109,17,0.45)"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* EMAIL */}
            <Text style={s.fieldLabel}>Email</Text>
            <View style={s.inputWrap}>
              <Text style={s.inputIcon}>✉️</Text>
              <TextInput
                style={s.input}
                placeholder="tu@email.com"
                placeholderTextColor="rgba(59,109,17,0.45)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* CONTRASEÑA */}
            <Text style={s.fieldLabel}>Contraseña</Text>
            <View style={s.inputWrap}>
              <Text style={s.inputIcon}>🔒</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="rgba(59,109,17,0.45)"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
                <Text style={s.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* Barra fortaleza */}
            {password.length > 0 && (
              <View style={s.strengthWrap}>
                <View style={s.strengthBars}>
                  {[1, 2, 3, 4].map(i => (
                    <View
                      key={i}
                      style={[
                        s.strengthBar,
                        { backgroundColor: i <= strength.level ? strength.color : 'rgba(59,109,17,0.15)' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[s.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            )}

            {/* REPETIR CONTRASEÑA */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Repetir contraseña</Text>
            <View style={[
              s.inputWrap,
              passwordsMismatch && { borderColor: '#EF4444' },
              passwordsMatch    && { borderColor: GREEN },
            ]}>
              <Text style={s.inputIcon}>🔒</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Repite tu contraseña"
                placeholderTextColor="rgba(59,109,17,0.45)"
                secureTextEntry={!showPw2}
                value={password2}
                onChangeText={setPassword2}
              />
              <TouchableOpacity onPress={() => setShowPw2(v => !v)} style={s.eyeBtn}>
                <Text style={s.eyeIcon}>{showPw2 ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            {passwordsMismatch && (
              <Text style={s.errorText}>Las contraseñas no coinciden</Text>
            )}
            {passwordsMatch && (
              <Text style={s.successText}>✓ Las contraseñas coinciden</Text>
            )}

            {/* BOTÓN */}
            <TouchableOpacity
              style={[s.btnPrimary, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Crear cuenta</Text>
              }
            </TouchableOpacity>

            {/* LOGIN */}
            <View style={s.loginRow}>
              <Text style={s.loginHint}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={s.loginLink}>Inicia sesión</Text>
              </TouchableOpacity>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, width, height },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240,248,232,0.25)',
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    paddingTop: height * 0.06,
    paddingBottom: 16,
    paddingHorizontal: 28,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    color: GREEN,
    fontWeight: '600',
  },
  logo: {
    width: 110,
    height: 110,
  },
  subtitle: {
    fontSize: 13,
    color: GREEN,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.7,
  },

  // Form
  formSection: {
    paddingHorizontal: 28,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
    marginBottom: 8,
    marginTop: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN_LIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,109,17,0.15)',
    paddingHorizontal: 14,
    marginBottom: 14,
    minHeight: 54,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: GREEN,
    fontWeight: '500',
    paddingVertical: 0,
  },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },

  // Fortaleza
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -6,
    marginBottom: 8,
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
    fontSize: 11,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'right',
  },

  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  successText: {
    fontSize: 12,
    color: GREEN,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Botón
  btnPrimary: {
    backgroundColor: GREEN,
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Login
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginHint: {
    fontSize: 14,
    color: 'rgba(59,109,17,0.65)',
  },
  loginLink: {
    fontSize: 14,
    color: GREEN,
    fontWeight: '800',
  },
});