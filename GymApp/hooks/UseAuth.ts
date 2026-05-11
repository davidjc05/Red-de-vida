// hooks/useAuth.ts

import { useState, useEffect } from "react";
import { getToken, getUserId, getRole } from "@/services/api";

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  loading: boolean;
}

export function useAuth(): AuthState {

  const [state, setState] = useState<AuthState>({
    token: null,
    userId: null,
    role: null,
    loading: true,
  });

  useEffect(() => {

    async function load() {

      try {

        const token = await getToken();
        const userId = await getUserId();
        const role = await getRole();

        setState({
          token,
          userId,
          role,
          loading: false,
        });

      } catch {

        setState({
          token: null,
          userId: null,
          role: null,
          loading: false,
        });

      }

    }

    load();

  }, []);

  return state;
}