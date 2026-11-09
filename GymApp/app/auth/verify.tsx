import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthShell, AuthInput, AuthButton } from '../../components/AuthShell';
import { verifyEmail, resendCode } from '../../services/api';
import { notify } from '../../services/ui';

export default function VerifyScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = String(emailParam ?? '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (code.trim().length !== 6) { notify('Código', 'Introduce los 6 dígitos del código.'); return; }
    setLoading(true);
    try {
      const res = await verifyEmail(email, code.trim());
      notify(
        'Email verificado',
        res?.status === 'pending'
          ? 'Tu email está verificado. Ahora tu entrenador debe aprobar tu cuenta; cuando lo haga podrás iniciar sesión.'
          : 'Tu email está verificado. Ya puedes iniciar sesión.',
      );
      router.replace('/auth/login');
    } catch (e: any) {
      notify('Error', e?.message || 'Código incorrecto o caducado');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendCode(email);
      notify('Código enviado', 'Si el email es correcto, recibirás un código nuevo en unos segundos (puedes pedir uno cada minuto).');
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Verifica tu email"
      subtitle={`Hemos enviado un código de 6 dígitos a ${email}. Revisa también la carpeta de spam. Caduca en 15 minutos.`}
    >
      <AuthInput
        label="Código"
        value={code}
        onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
      />
      <AuthButton text="Verificar" onPress={handleVerify} loading={loading} />
      <AuthButton text="Reenviar código" onPress={handleResend} loading={resending} secondary />
      <AuthButton text="Volver al inicio de sesión" onPress={() => router.replace('/auth/login')} secondary />
    </AuthShell>
  );
}
