// Fecha de nacimiento: en pantalla DD/MM/AAAA, en la API AAAA-MM-DD.

// Escribe solo los números: la barra se pone sola nada más completar el día y el mes
// (24 -> 24/ ; 2405 -> 24/05/). `prev` es el texto anterior, para no volver a poner la barra al borrar.
export function maskBirth(input: string, prev: string = ''): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  const typing = input.length > prev.length;
  let out = d.slice(0, 2);
  if (d.length > 2 || (typing && d.length === 2)) out += '/';
  out += d.slice(2, 4);
  if (d.length > 4 || (typing && d.length === 4)) out += '/';
  out += d.slice(4);
  return out;
}

// '' -> null (campo vacío) | 'AAAA-MM-DD' si es válida | 'invalid'
export function parseBirth(input: string): string | null | 'invalid' {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return 'invalid';
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  const real = dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  if (!real || y < 1900 || dt.getTime() > Date.now()) return 'invalid';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 'AAAA-MM-DD' -> 'DD/MM/AAAA' ('' si no hay fecha)
export function formatBirth(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

export function ageFrom(iso?: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}
