// Texto de la política de privacidad. Si cambias algo importante, actualiza también
// PRIVACY_VERSION en el backend (legal.py).
// Opcional: define EXPO_PUBLIC_CONTACT_EMAIL en Render (Static Site) para mostrar un correo de contacto.
export const CONTACT_EMAIL = process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? '';

export const PRIVACY_UPDATED = 'noviembre de 2026';

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Quién es el responsable',
    body:
      'El responsable del tratamiento de tus datos es la entrenadora titular de Red de Vida, que administra esta aplicación y prepara tus entrenamientos.' +
      (CONTACT_EMAIL ? ` Puedes escribirle a ${CONTACT_EMAIL}.` : ' Puedes contactar con ella directamente o a través de la propia aplicación.'),
  },
  {
    title: '2. Qué datos tratamos',
    body:
      'Datos de tu cuenta: nombre, correo electrónico, teléfono, país, ciudad, fecha de nacimiento y tu contraseña (guardada cifrada, nunca en texto legible).\n\n' +
      'Datos de tu entrenamiento: rutinas que se te asignan, si las completas, pesos y repeticiones que registras, y tu actividad física (tiempo, distancia y calorías estimadas al caminar o correr). Estos datos pueden considerarse datos relativos a la salud.',
  },
  {
    title: '3. Para qué los usamos',
    body:
      'Para crear y gestionar tu cuenta, planificar y seguir tus entrenamientos, enviarte mensajes del servicio (códigos de verificación, recuperación de contraseña y formularios que tu entrenadora te envíe) y poder contactar contigo. No usamos tus datos para publicidad ni los vendemos.',
  },
  {
    title: '4. Base legal',
    body:
      'Tu consentimiento explícito, que das al marcar la casilla al registrarte, y la ejecución del servicio de entrenamiento que has solicitado. Puedes retirar el consentimiento en cualquier momento borrando tu cuenta.',
  },
  {
    title: '5. Quién más puede acceder',
    body:
      'Tu entrenadora ve tus datos para poder atenderte. Para que la aplicación funcione usamos proveedores que tratan datos por encargo nuestro: Render (alojamiento de la aplicación), Supabase (base de datos) y Brevo (envío de correos). Si rellenas un formulario de Google que se te envíe, Google trata esas respuestas según sus propias condiciones. Algunos de estos proveedores pueden estar fuera del Espacio Económico Europeo y aplican garantías como las cláusulas contractuales tipo.',
  },
  {
    title: '6. Cuánto tiempo los guardamos',
    body:
      'Mientras tengas la cuenta. Si la borras, se eliminan tus datos de la aplicación. Los códigos de verificación caducan a los 15 minutos.',
  },
  {
    title: '7. Tus derechos',
    body:
      'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte o limitar su tratamiento y pedir su portabilidad. En tu perfil puedes editar tus datos, descargar una copia en formato JSON y eliminar tu cuenta (los clientes). También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
  },
  {
    title: '8. Menores',
    body:
      'Si tienes menos de 14 años necesitas el consentimiento de tu madre, padre o tutor legal para usar la aplicación.',
  },
];
