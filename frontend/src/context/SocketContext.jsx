import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../api/axios";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setOnlineUsers([]);
      }
      return;
    }

    const newSocket = io(API_BASE, { autoConnect: true });

    newSocket.on("connect", () => {
      newSocket.emit("register", user.userNumber);
    });

    newSocket.on("onlineUsers", (users) => {
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.userNumber]);

  const sendMessage = useCallback(
    (receiver, content) => {
      if (!socket || !user) return;
      socket.emit("sendMessage", {
        sender: user.userNumber,
        receiver,
        content,
      });
    },
    [socket, user]
  );

  const emitTyping = useCallback(
    (receiver) => {
      if (!socket || !user) return;
      socket.emit("typing", { sender: user.userNumber, receiver });
    },
    [socket, user]
  );

  const emitStopTyping = useCallback(
    (receiver) => {
      if (!socket || !user) return;
      socket.emit("stopTyping", { sender: user.userNumber, receiver });
    },
    [socket, user]
  );

  const markRead = useCallback(
    (receiver) => {
      if (!socket || !user) return;
      socket.emit("markRead", { sender: user.userNumber, receiver });
    },
    [socket, user]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        sendMessage,
        emitTyping,
        emitStopTyping,
        markRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};
