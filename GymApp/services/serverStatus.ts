// Detecta cuándo el servidor tarda mucho en responder (Render gratis se "duerme"
// y tarda 30–60 s en despertar) para avisar al usuario en lugar de dejarle en blanco.
type Listener = (waking: boolean) => void;

const WAKE_AFTER_MS = 4000;
const listeners = new Set<Listener>();
let pending = 0;
let waking = false;

function setWaking(value: boolean) {
  if (waking === value) return;
  waking = value;
  listeners.forEach((fn) => fn(value));
}

export function subscribeWaking(fn: Listener): () => void {
  listeners.add(fn);
  fn(waking);
  return () => {
    listeners.delete(fn);
  };
}

// Igual que fetch, pero marca "despertando" si la respuesta tarda más de 4 s
export async function wakeAwareFetch(url: string, init?: RequestInit) {
  pending += 1;
  const timer = setTimeout(() => setWaking(true), WAKE_AFTER_MS);
  try {
    return await fetch(url, init);
  } finally {
    clearTimeout(timer);
    pending -= 1;
    if (pending <= 0) {
      pending = 0;
      setWaking(false);
    }
  }
}
