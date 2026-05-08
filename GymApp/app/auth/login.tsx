import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  ImageBackground,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { login } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

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
        router.replace('../(tabs)/inicio');
      }
    } catch (e: any) {
      Alert.alert('Error de acceso', e?.message || 'Error desconocido');
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
      {/* Overlay suave para dar legibilidad */}
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

          {/* ── LOGO ── */}
          <View style={s.logoSection}>
            <Image
              source={require('../../assets/images/logotipo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── FORMULARIO ── */}
          <View style={s.formSection}>

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
                placeholder="••••••••"
                placeholderTextColor="rgba(59,109,17,0.45)"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={s.eyeBtn}
              >
                <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* BOTÓN INICIAR */}
            <TouchableOpacity
              style={[s.btnPrimary, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Iniciar sesión</Text>
              }
            </TouchableOpacity>

            {/* OLVIDÉ */}
            <TouchableOpacity style={s.forgotWrap}>
              <Text style={s.forgot}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            {/* REGISTRO */}
            <View style={s.registerRow}>
              <Text style={s.registerHint}>¿Sin cuenta? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={s.registerLink}>Regístrate</Text>
              </TouchableOpacity>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const GREEN = '#3B6D11';
const GREEN_LIGHT = 'rgba(234,243,222,0.92)';
const GREEN_MID = 'rgba(59,109,17,0.12)';

const s = StyleSheet.create({
  bg: { flex: 1, width, height },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240,248,232,0.25)',
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    paddingTop: height * 0.1,
    paddingBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
  },

  // Form
  formSection: {
    paddingHorizontal: 28,
    gap: 0,
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
    marginBottom: 16,
    minHeight: 54,
    // Glassmorphism suave
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

  // Botón
  btnPrimary: {
    backgroundColor: GREEN,
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
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

  // Olvidé
  forgotWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgot: {
    fontSize: 13,
    color: GREEN,
    fontWeight: '500',
  },

  // Registro
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerHint: {
    fontSize: 14,
    color: 'rgba(59,109,17,0.65)',
  },
  registerLink: {
    fontSize: 14,
    color: GREEN,
    fontWeight: '800',
  },
});