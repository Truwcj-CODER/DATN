import { io } from "socket.io-client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

const socket = io(BACKEND, {
  path: "/socket.io",
  transports: ["polling", "websocket"],
  autoConnect: true,
});

export default socket;
