// services/streamClient.ts
// Instancia global del cliente de Stream Chat.
// Importar en cualquier pantalla que necesite chat.

import { StreamChat } from "stream-chat";
import AsyncStorage from "@react-native-async-storage/async-storage";

let client: StreamChat | null = null;

export function getStreamClient(): StreamChat {
  if (!client) {
    // La API key viene del endpoint /api/chat/token (no hardcodeada aquí)
    // Se sobreescribe en connectUser con la key real
    client = StreamChat.getInstance("placeholder");
  }
  return client;
}

/**
 * Conecta el usuario autenticado a Stream.
 * Llamar después del login, en el contexto de autenticación.
 *
 * @param apiKey   - Viene de tu backend (/api/chat/token)
 * @param userId   - ID del usuario en tu base de datos
 * @param userName - Nombre a mostrar en el chat
 * @param token    - Token JWT generado por tu backend Flask
 */
export async function connectStreamUser(
  apiKey: string,
  userId: string,
  userName: string,
  token: string
): Promise<void> {
  // Recrear cliente con la key real si era placeholder
  if (!client || (client as any).key === "placeholder") {
    if (client) await client.disconnectUser();
    client = StreamChat.getInstance(apiKey);
  }

  // Evitar reconectar si ya está conectado el mismo usuario
  if (client.userID === userId) return;

  await client.connectUser(
    { id: userId, name: userName },
    token
  );

  // Guardar datos para reconexión sin backend (offline/background)
  await AsyncStorage.setItem(
    "stream_user",
    JSON.stringify({ apiKey, userId, userName, token })
  );
}

/**
 * Desconectar al hacer logout.
 */
export async function disconnectStreamUser(): Promise<void> {
  if (client) {
    await client.disconnectUser();
    client = null;
  }
  await AsyncStorage.removeItem("stream_user");
}