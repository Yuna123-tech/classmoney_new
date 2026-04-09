import { io } from "socket.io-client";

const socket = io({
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
});

export default socket;
