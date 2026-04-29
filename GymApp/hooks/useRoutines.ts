import { useState, useEffect, useCallback } from 'react';
import { getRoutines } from '../services/api';

export type Exercise = { id: number; name: string; muscle_group: string; description?: string };
export type Routine = { 
  id: number; 
  name: string; 
  owner_id?: number;
  user_id?: number;
  exercises: Exercise[]; 
};

export function useRoutines() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoutines();
      // Garantizar que exercises siempre es array
      const normalized = data.map((r: any) => ({ ...r, exercises: r.exercises ?? [] }));
      setRoutines(normalized);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { routines, loading, error, reload: load };
}