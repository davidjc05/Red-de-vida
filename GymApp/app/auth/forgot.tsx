import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthShell, AuthInput, AuthButton } from '../../components/AuthShell';
import { forgotPassword, resetPassword } from '../../services/api';
import { notify } from '../../services/ui';

export default function ForgotScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!email.trim()) { notify('Email', 'Escribe tu email.'); return; }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep(2);
      notify('Código enviado', 'Si ese email tiene cuenta, recibirás un código en unos segundos. Revisa también el spam.');
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    if (code.trim().length !== 6) { notify('Código', 'Introduce los 6 dígitos del código.'); return; }
    if (pw.length < 8) { notify('Contraseña', 'La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (pw !== pw2) { notify('Contraseña', 'Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), pw);
      notify('Contraseña cambiada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
      router.replace('/auth/login');
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle={step === 1
        ? 'Escribe tu email y te enviaremos un código para crear una contraseña nueva.'
        : `Introduce el código que hemos enviado a ${email.trim()} y tu nueva contraseña.`}
    >
      {step === 1 ? (
        <>
          <AuthInput
            label="Email" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="tu@email.com"
          />
          <AuthButton text="Enviar código" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <AuthInput
            label="Código" value={code}
            onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" maxLength={6} placeholder="123456"
          />
          <AuthInput label="Nueva contraseña (mín. 8)" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
          <AuthInput label="Repite la contraseña" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
          <AuthButton text="Cambiar contraseña" onPress={reset} loading={loading} />
          <AuthButton text="Pedir otro código" onPress={sendCode} secondary />
        </>
      )}
      <AuthButton text="Volver al inicio de sesión" onPress={() => router.replace('/auth/login')} secondary />
    </AuthShell>
  );
}
