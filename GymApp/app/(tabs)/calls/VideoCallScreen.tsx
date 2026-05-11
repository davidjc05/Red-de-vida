// app/(tabs)/calls/VideoCallScreen.tsx
// Videollamada con Daily.co usando WebView — sin conflictos de tipos.

import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { deleteCallRoom } from "@/services/callService";
import { useAuth } from "@/hooks/UseAuth";

export default function VideoCallScreen() {
  const { roomUrl, roomName, meetingToken } = useLocalSearchParams<{
    roomUrl: string;
    roomName: string;
    meetingToken: string;
  }>();

  const { token: authToken } = useAuth();
  const webViewRef = useRef(null);

  // URL con token embebido para que Daily autentique al usuario
  const fullUrl = roomUrl
    ? `${roomUrl}?t=${meetingToken}`
    : null;

  async function handleLeave() {
    if (authToken && roomName) {
      await deleteCallRoom(authToken, roomName);
    }
    router.back();
  }

  if (!fullUrl) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>URL de sala no disponible</Text>
        <TouchableOpacity style={styles.leaveBtn} onPress={() => router.back()}>
          <Text style={styles.leaveBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: fullUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Conectando...</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
        <Text style={styles.leaveBtnText}>✕ Salir</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorText: {
    color: "#fff",
    marginBottom: 16,
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
  },
  leaveBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    backgroundColor: "rgba(220,38,38,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  leaveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});