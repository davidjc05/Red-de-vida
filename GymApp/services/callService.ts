// // services/callService.ts

// const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

// export interface CallRoom {
//   roomUrl: string;
//   roomName: string;
//   trainerToken: string;
//   clientToken: string;
//   expiresAt: number;
// }

// export async function createCallRoom(
//   authToken: string,
//   clientId: string
// ): Promise<CallRoom> {
//   const response = await fetch(`${API_BASE}/api/calls/create`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${authToken}`,
//     },
//     body: JSON.stringify({ clientId }),
//   });

//   if (!response.ok) {
//     throw new Error("No se pudo crear la sala de videollamada");
//   }

//   return response.json();
// }

// export async function deleteCallRoom(
//   authToken: string,
//   roomName: string
// ): Promise<void> {
//   await fetch(`${API_BASE}/api/calls/delete/${roomName}`, {
//     method: "DELETE",
//     headers: { Authorization: `Bearer ${authToken}` },
//   }).catch(() => {});
// }