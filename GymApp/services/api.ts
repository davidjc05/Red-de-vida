import { storage } from './storage';

const API_URL = 'http://127.0.0.1:8000'; // ← cambia por tu IP local

// ── Token ──────────────────────────────────────────────────────────────────────
export async function saveToken(token: string) { 
  await storage.setItem('token', token); 
}
export async function getToken() {
  return await storage.getItem('token');
}
export async function deleteToken() { await storage.removeItem('token');}

// ── Helper ─────────────────────────────────────────────────────────────────────
async function authFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', body: new URLSearchParams({ username: email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión');
  await saveToken(data.access_token);
  return data;
}

export async function register(name: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  name: string, 
  muscle_group: string, 
  description?: string,
  image_url?: string,
  video_url?: string
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
  const res = await authFetch('/routines/');
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al cargar rutinas');
  return data;
}

export async function createRoutine(name: string) {
  const res = await authFetch('/routines/', {
    method: 'POST', body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al crear rutina');
  return data;
}

export async function addExerciseToRoutine(routineId: number, exerciseId: number) {
  const res = await authFetch(`/routines/${routineId}/exercises/${exerciseId}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al añadir ejercicio');
  return data;
}

export async function removeExerciseFromRoutine(routineId: number, exerciseId: number) {
  const res = await authFetch(`/routines/${routineId}/exercises/${exerciseId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Error al quitar ejercicio');
  return data;
}

// ── Asignaciones ───────────────────────────────────────────────────────────────
export async function assignRoutine(routineId: number, assignedToId: number, note?: string) {
  const res = await authFetch('/assignments/', {
    method: 'POST',
    body: JSON.stringify({ routine_id: routineId, assigned_to_id: assignedToId, note }),
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