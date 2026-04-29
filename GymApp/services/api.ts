import { storage } from './storage';

export const API_URL = 'https://pajamas-operable-traitor.ngrok-free.dev';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getRole(): Promise<string | null> {
  return await storage.getItem('role');
}

// ── Token y usuario ────────────────────────────────────────────────────────────
export async function saveToken(token: string) {
  await storage.setItem('token', token);
}

export async function getToken() {
  return await storage.getItem('token');
}

export async function deleteToken() {
  await storage.removeItem('token');
  await storage.removeItem('user_id');
  await storage.removeItem('role'); // 👈 importante también borrar role
}

async function saveUserId(id: number) {
  await storage.setItem('user_id', String(id));
}

export async function getUserId(): Promise<number | null> {
  const id = await storage.getItem('user_id');
  return id ? Number(id) : null;
}

// ── Headers comunes ────────────────────────────────────────────────────────────
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

// ── Helper fetch autenticado ───────────────────────────────────────────────────
async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...COMMON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'ngrok-skip-browser-warning': 'true' },
    body: new URLSearchParams({ username: email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión');

  await saveToken(data.access_token);

  const meRes = await authFetch('/auth/me');
  const me = await meRes.json();

  console.log("ME RESPONSE:", me);

  if (meRes.ok) {
    await saveUserId(me.id);
    await storage.setItem('role', me.role); // 👈 CLAVE
  }

  return data;
}

export async function register(name: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { ...COMMON_HEADERS },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al registrarse');

  return data;
}

export async function getMe() {
  const res = await authFetch('/auth/me');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'No autorizado');
  return data;
}

// ── Usuarios ───────────────────────────────────────────────────────────────────
export async function getUsers() {
  const res = await authFetch('/users/');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar usuarios');
  return data;
}

// ── Ejercicios ─────────────────────────────────────────────────────────────────
export async function getExercises(muscleGroup?: string) {
  const query = muscleGroup ? `?muscle_group=${encodeURIComponent(muscleGroup)}` : '';
  const res = await authFetch(`/exercises/${query}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar ejercicios');
  return data;
}

export async function createExercise(exerciseData: {
  name: string;
  muscle_group: string;
  description?: string;
  image_url?: string;
  video_url?: string;
}) {
  const res = await authFetch('/exercises/', {
    method: 'POST',
    body: JSON.stringify(exerciseData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al crear ejercicio');
  return data;
}

// ── Rutinas ────────────────────────────────────────────────────────────────────
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

export async function addExerciseToRoutine(routineId: number, exerciseId: number) {
  const res = await authFetch(`/routines/${routineId}/exercises/${exerciseId}`, {
    method: 'POST',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al añadir ejercicio');
  return data;
}

export async function removeExerciseFromRoutine(routineId: number, exerciseId: number) {
  const res = await authFetch(`/routines/${routineId}/exercises/${exerciseId}`, {
    method: 'DELETE',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al quitar ejercicio');
  return data;
}

// ── Asignaciones ───────────────────────────────────────────────────────────────
export async function assignRoutine(
  routineId: number,
  assignedToId: number,
  note?: string
) {
  const res = await authFetch('/assignments/', {
    method: 'POST',
    body: JSON.stringify({
      routine_id: routineId,
      assigned_to_id: assignedToId,
      note,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al asignar rutina');
  return data;
}

export async function getMyAssignments() {
  const res = await authFetch('/assignments/mine');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar asignaciones');
  return data;
}