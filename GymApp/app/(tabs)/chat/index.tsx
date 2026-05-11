// app/(tabs)/chat/index.tsx
// Lista de conversaciones del entrenador con sus clientes.
// Stream Chat renderiza avatares, último mensaje y hora automáticamente.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import {
  Chat,
  ChannelList,

} from "stream-chat-expo";
import { getStreamClient, connectStreamUser } from "@/services/streamClient";
import { useAuth } from "../../../hooks/UseAuth"; 

const FILTERS = (userId: string) => ({
  type: "messaging",
  members: { $in: [userId] },
});

const SORT = [{ last_message_at: -1 as const }];

export default function ChatListScreen() {
  const { token: authToken, userId } = useAuth();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !authToken) return;

    (async () => {
      try {
        // 1. Pedir token Stream al backend
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/chat/token`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        const data = await res.json();

        // 2. Conectar cliente Stream
        await connectStreamUser(
          data.apiKey,
          data.userId,
          data.userName,
          data.token
        );

        setReady(true);
      } catch (e) {
        setError("No se pudo conectar al chat. Intenta de nuevo.");
      }
    })();
  }, [userId, authToken]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const client = getStreamClient();

  return (
    <Chat client={client}>
      <ChannelList
        filters={FILTERS(userId!.toString())}
        sort={SORT}
        onSelect={(channel) => {
            router.push(`/chat/${channel.cid}`);
        }}
    />
    </Chat>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    padding: 16,
  },
});