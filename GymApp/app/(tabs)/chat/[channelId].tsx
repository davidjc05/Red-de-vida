// // app/(tabs)/chat/[channelId].tsx
// // Pantalla de conversación 1-a-1.
// // Incluye botón para iniciar videollamada desde el header.

// import React, { useEffect, useState } from "react";
// import { View, TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
// import { useLocalSearchParams, router, Stack } from "expo-router";
// import {
//   Chat,
//   Channel,
//   MessageList,
//   MessageInputProvider,
//   MessageInputFooterView,
//   MessageInputContext,

// } from "stream-chat-expo";
// import { getStreamClient } from "@/services/streamClient";
// import { createCallRoom } from "@/services/callService";
// import { useAuth } from "@/hooks/UseAuth";

// export default function ChatScreen() {
//   const { channelId } = useLocalSearchParams<{ channelId: string }>();
//   const { token: authToken } = useAuth();
//   const [channel, setChannel] = useState<any>(null);
//   const [startingCall, setStartingCall] = useState(false);

//   useEffect(() => {
//     const client = getStreamClient();
//     // channelId llega como "messaging:dm-1-2", separar tipo e ID
//     const [type, id] = (channelId ?? "").split(":");
//     const ch = client.channel(type || "messaging", id);
//     setChannel(ch);
//   }, [channelId]);

//   /**
//    * Inicia videollamada:
//    * 1. Crea sala en Daily via backend
//    * 2. Envía un mensaje especial en el chat con la URL
//    * 3. Navega a la pantalla de videollamada
//    */
//   async function handleStartCall() {
//     if (!channel || !authToken) return;
//     setStartingCall(true);

//     try {
//       // Extraer el clientId del canal (el otro miembro que no es yo)
//       const client = getStreamClient();
//       const members = Object.keys(channel.state.members);
//       const otherId = members.find((id) => id !== client.userID) ?? "";

//       const room = await createCallRoom(authToken, otherId);

//       // Notificar al cliente en el chat
//       await channel.sendMessage({
//         text: `📹 Videollamada iniciada. Únete aquí: ${room.roomUrl}`,
//         attachments: [
//           {
//             type: "call_invite",
//             room_url: room.roomUrl,
//             room_name: room.roomName,
//             client_token: room.clientToken,
//           },
//         ],
//       });

//       // Navegar a la pantalla de videollamada (entrenador usa trainerToken)
//       router.push({
//         pathname: "/calls/VideoCallScreen",
//         params: {
//           roomUrl: room.roomUrl,
//           roomName: room.roomName,
//           meetingToken: room.trainerToken,
//         },
//       });
//     } catch (e) {
//       Alert.alert("Error", "No se pudo iniciar la videollamada.");
//     } finally {
//       setStartingCall(false);
//     }
//   }

//   if (!channel) return null;

//   const client = getStreamClient();

//   return (
//     <>
//       {/* Botón de videollamada en el header */}
//       <Stack.Screen
//         options={{
//           headerRight: () => (
//             <TouchableOpacity
//               onPress={handleStartCall}
//               disabled={startingCall}
//               style={styles.callButton}
//             >
//               <Text style={styles.callButtonText}>
//                 {startingCall ? "⏳" : "📹"}
//               </Text>
//             </TouchableOpacity>
//           ),
//         }}
//       />

//       <Chat client={client}>
//         <Channel channel={channel}>
//           <MessageList />
//           <Channel channel={channel}>
//           <MessageList />
//           <MessageInputContext.Consumer>
//             {(value) => (
//               <MessageInputProvider value={value}>
//                 <MessageInputFooterView />
//               </MessageInputProvider>
//             )}
//           </MessageInputContext.Consumer>
//         </Channel>
//         </Channel>
//       </Chat>
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   callButton: {
//     marginRight: 12,
//     padding: 6,
//   },
//   callButtonText: {
//     fontSize: 22,
//   },
// });