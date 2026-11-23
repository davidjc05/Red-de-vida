import { storage } from './storage';
import { wakeAwareFetch } from './serverStatus';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';


// ── Token ─────────────────────────────────────────────────────
export async function saveToken(token: string) {
  await storage.setItem('token', token);
}

export async function getToken() {
  return await storage.getItem('token');
}

export async function deleteToken() {
  await storage.removeItem('token');
  await storage.removeItem('user_id');
  await storage.removeItem('role');
}

async function saveUserId(id: number) {
  await storage.setItem('user_id', String(id));
}

export async function getUserId(): Promise<number | null> {
  const id = await storage.getItem('user_id');
  return id ? Number(id) : null;
}

export async function getRole(): Promise<string | null> {
  return await storage.getItem('role');
}

// Pantalla de inicio según el rol: el entrenador (admin) va a rutinas, el resto al calendario
export function homeFor(role?: string | null) {
  return role === 'admin'
    ? ('/(tabs)/routines' as const)
    : ('/(tabs)/calendar' as const);
}

// ── Sesión caducada ───────────────────────────────────────────
// La pantalla que esté abierta registra aquí qué hacer cuando el servidor responde 401
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// ── Headers ───────────────────────────────────────────────────
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

// ── Fetch con auth ─────────────────────────────────────────────
async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();

  const res = await wakeAwareFetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...COMMON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Token enviado pero rechazado: la sesión ya no vale → se borra y se avisa
  if (res.status === 401 && token) {
    await deleteToken();
    onUnauthorized?.();
  }

  return res;
}

// ── AUTH ──────────────────────────────────────────────────────
export async function login(email: string, password: string) {

  const res = await wakeAwareFetch(`${API_URL}/auth/login`, {
    method: 'POST',

    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
    },

    body: new URLSearchParams({
      username: email,
      password,
    }).toString(),
  });

  const text = await res.text();


  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }

  if (!res.ok) {
    throw new Error(
      typeof data.detail === 'string'
        ? data.detail
        : JSON.stringify(data.detail)
    );
  }

  await saveToken(data.access_token);

  const meRes = await authFetch('/auth/me');
  const me = await meRes.json();

  if (meRes.ok) {
    await saveUserId(me.id);
    await storage.setItem('role', me.role);
  }

  return data;
}

// Los errores de validación (422) traen `detail` como lista: la convertimos en texto
function detailToText(detail: any, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: any) => String(d?.msg ?? '').replace(/^Value error, /, '')).filter(Boolean);
    if (msgs.length) return msgs.join('. ');
  }
  return fallback;
}

export type ProfileFields = {
  phone?: string;
  country?: string;
  city?: string;
  birth_date?: string | null; // AAAA-MM-DD
};

export async function register(
  name: string,
  email: string,
  password: string,
  extra: ProfileFields & { accept_terms?: boolean } = {},
) {
  const res = await wakeAwareFetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({ name, email, password, ...extra }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'Error al registrarse'));

  return data;
}

async function postJson(path: string, body: object, fallback: string) {
  const res = await wakeAwareFetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(detailToText(data.detail, fallback));
  return data;
}

// Verificación de email y recuperación de contraseña
export const verifyEmail = (email: string, code: string) =>
  postJson('/auth/verify-email', { email, code }, 'Código incorrecto o caducado');
export const resendCode = (email: string) =>
  postJson('/auth/resend-code', { email }, 'No se pudo reenviar el código');
export const forgotPassword = (email: string) =>
  postJson('/auth/forgot-password', { email }, 'No se pudo enviar el código');
export const resetPassword = (email: string, code: string, new_password: string) =>
  postJson('/auth/reset-password', { email, code, new_password }, 'No se pudo cambiar la contraseña');

export async function changePassword(current_password: string, new_password: string) {
  const res = await authFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo cambiar la contraseña'));
  return data;
}

// Derechos del usuario: descargar sus datos (texto JSON) y borrar su cuenta
export async function exportMyData(): Promise<string> {
  const res = await authFetch('/auth/me/export');
  if (!res.ok) throw new Error('No se pudieron descargar tus datos');
  return JSON.stringify(await res.json(), null, 2);
}

export async function deleteMyAccount(password: string) {
  const res = await authFetch('/auth/me/delete', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo borrar la cuenta'));
  return data;
}

// El propio usuario edita su perfil
export async function updateMe(fields: ProfileFields & { name?: string; weight_kg?: number }) {
  const res = await authFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo guardar el perfil'));
  return data;
}

// Entrenador: aprobar un alta, cancelar la suscripción o reactivarla
export async function setUserStatus(id: number, status: 'active' | 'suspended') {
  const res = await authFetch(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo cambiar el estado'));
  return data;
}

// ── Formularios (enlaces de Google Forms) ──
async function formsRequest(path: string, init: RequestInit | undefined, fallback: string) {
  const res = await authFetch(path, init);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, fallback));
  return data;
}
export const getForms = () => formsRequest('/forms', undefined, 'No se pudieron cargar los formularios');
export const createForm = (title: string, url: string) =>
  formsRequest('/forms', { method: 'POST', body: JSON.stringify({ title, url }) }, 'No se pudo guardar el formulario');
export const deleteForm = (id: number) =>
  formsRequest(`/forms/${id}`, { method: 'DELETE' }, 'No se pudo borrar el formulario');
export const sendForm = (formId: number, userId: number) =>
  formsRequest(`/forms/${formId}/send`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }, 'No se pudo enviar el formulario');
export const getFormsSentTo = (userId: number) =>
  formsRequest(`/forms/sent/${userId}`, undefined, 'No se pudo cargar el historial');
export const getMyForms = () => formsRequest('/forms/mine', undefined, 'No se pudieron cargar tus formularios');

export async function getMe() {
  const res = await authFetch('/auth/me');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'No autorizado');
  return data;
}

// ── USERS ─────────────────────────────────────────────────────
export async function getUsers() {
  const res = await authFetch('/users/');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar usuarios');
  return data;
}

// ── SEGUIMIENTO (entrenadora) ────────────────────────────────
export type HistoryExercise = {
  exercise_id: number;
  name: string;
  planned_sets: number | null;
  planned_reps: number | null;
  logged: boolean;
  kg: number | null;
  reps: number | null;
};
export type HistoryWorkout = {
  assignment_id: number;
  date: string;
  routine_name: string;
  status: 'pending' | 'confirmed' | 'declined' | string;
  note: string | null;
  confirmed_at: string | null;
  exercises: HistoryExercise[];
};
export type ClientHistory = {
  client: { id: number; name: string };
  workouts: HistoryWorkout[];
};

export async function getClientHistory(userId: number): Promise<ClientHistory> {
  const res = await authFetch(`/tracking/client/${userId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo cargar el seguimiento'));
  return data;
}

// ── EJERCICIOS ────────────────────────────────────────────────
export async function getExercises(muscleGroup?: string) {
  const query = muscleGroup ? `?muscle_group=${encodeURIComponent(muscleGroup)}` : '';
  const res = await authFetch(`/exercises${query}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar ejercicios');
  return data;
}
type ExerciseInput = {
  name: string;
  muscle_group: string;
  description?: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

async function readError(res: Response, fallback: string) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return typeof data.detail === 'string' ? data.detail : fallback;
  } catch {
    return text || fallback;
  }
}

export async function createExercise(exercise: ExerciseInput) {
  const res = await authFetch('/exercises', {
    method: 'POST',
    body: JSON.stringify(exercise),
  });
  if (!res.ok) throw new Error(await readError(res, 'Error creando ejercicio'));
  return res.json();
}

export async function updateExercise(id: number, exercise: Partial<ExerciseInput>) {
  const res = await authFetch(`/exercises/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(exercise),
  });
  if (!res.ok) throw new Error(await readError(res, 'Error al guardar'));
  return res.json();
}

export async function deleteExercise(id: number) {
  const res = await authFetch(`/exercises/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Error al eliminar'));
  return true;
}

// ── RUTINAS ───────────────────────────────────────────────────
export async function getRoutines() {
  const res = await authFetch('/routines/me');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar rutinas');
  return data;
}

export async function createRoutine(name: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa');

  const today = new Date().toISOString().split('T')[0];

  const res = await authFetch('/routines/', {
    method: 'POST',
    body: JSON.stringify({
      name,
      user_id: userId,
      date: today,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al crear rutina');
  return data;
}

// Copia una rutina completa (para usarla como plantilla)
export async function duplicateRoutine(routineId: number) {
  const res = await authFetch(`/routines/${routineId}/duplicate`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo duplicar la rutina'));
  return data;
}

// Copia las rutinas de una semana de un cliente a otra semana y/o a otros clientes
export async function copyWeek(payload: {
  source_user_id: number;
  source_start: string;
  target_user_ids: number[];
  target_start: string;
  weeks: number;
}): Promise<{ created: number; skipped: number }> {
  const res = await authFetch('/assignments/copy-week', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo copiar la semana'));
  return data;
}

export async function deleteRoutine(routineId: number) {
  const res = await authFetch(`/routines/${routineId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || 'Error al eliminar rutina');
  }

  return true;
}

// 🔥 NUEVO SISTEMA BUENO
export async function updateRoutineFull(
  routineId: number,
  name: string,
  blocks: any[]
) {
  const res = await authFetch(`/routines/${routineId}/full`, {
    method: 'PUT',
    body: JSON.stringify({
      name,
      blocks,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || 'Error al actualizar rutina completa');
  }

  return data;
}
// ── ASIGNACIONES ──────────────────────────────────────────────

export async function assignRoutine(
  routineId: number,
  userIds: number[],
  date: string,
  note?: string
) {
  const res = await authFetch('/assignments/', {
    method: 'POST',
    body: JSON.stringify({
      routine_id: routineId,
      assigned_to_ids: userIds,
      date,
      note,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || 'Error al asignar rutina');
  }

  return data;
}

export async function getAssignmentsByRoutine(
  routineId: number
) {
  const res = await authFetch(
    `/assignments/routine/${routineId}`
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || 'Error al cargar asignaciones'
    );
  }

  return data;
}

export async function deleteAssignment(
  assignmentId: number
) {
  const res = await authFetch(
    `/assignments/${assignmentId}`,
    {
      method: 'DELETE',
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || 'Error al eliminar asignación'
    );
  }

  return data;
}

export async function getMyAssignments() {
  const res = await authFetch('/assignments/mine');

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || 'Error al cargar asignaciones'
    );
  }

  return data;
}

// Entrenador: sesiones de todos sus clientes (con nombre del cliente)
export async function getClientAssignments() {
  const res = await authFetch('/assignments/clients');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(detailToText(data.detail, 'Error al cargar sesiones de clientes'));
  }
  return data;
}

// Actividad (correr / caminar)
export async function saveActivity(a: {
  kind: 'run' | 'walk'; started_at: string; elapsed_s: number; distance_m: number; kcal: number;
}) {
  const res = await authFetch('/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'No se pudo enviar la actividad'));
  return data;
}

// Entrenador: actividades de todos sus clientes agrupadas por cliente
export async function getClientActivities() {
  const res = await authFetch('/activities/clients');
  const data = await res.json();
  if (!res.ok) throw new Error(detailToText(data.detail, 'Error al cargar actividades'));
  return data;
}

// ✅ CONFIRMAR / RECHAZAR

export async function confirmWorkout(
  assignmentId: number,
  status: 'confirmed' | 'declined'
) {
  const res = await authFetch(
    `/assignments/${assignmentId}/confirm`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.detail || 'Error confirmando entreno'
    );
  }

  return data;
}


// ✅ GUARDAR KG / REPS

export async function saveWorkoutLog(data: {
  assignment_id: number;
  exercise_id: number;
  kg: number;
  reps: number;
}) {
  const res = await authFetch(
    '/assignments/log',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json.detail || 'Error guardando log'
    );
  }

  return json;
}
// ── WORKOUT LOGS ──────────────────────────────────────────────
export async function getMyWorkoutLogs() {
  const res = await authFetch('/assignments/logs/mine');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar logs');
  return data;
}