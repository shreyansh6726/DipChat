import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { getMessages, markAsRead } from "../api/messages";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import "./ChatWindow.css";

const ChatWindow = ({ contact }) => {
  const { user } = useAuth();
  const { socket, onlineUsers, sendMessage, emitTyping, emitStopTyping, markRead } =
    useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!contact) return;
    setLoading(true);
    try {
      const { data } = await getMessages(user.userNumber, contact.userNumber);
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [contact, user.userNumber]);

  useEffect(() => {
    if (!contact) return;
    setMessages([]);
    fetchMessages();
    markRead(contact.userNumber);
    markAsRead(user.userNumber, contact.userNumber).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.userNumber]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket || !contact) return;

    const handleReceive = (message) => {
      if (message.sender === contact.userNumber) {
        setMessages((prev) => [...prev, message]);
        markRead(contact.userNumber);
      }
    };

    const handleSent = (message) => {
      if (message.sender === user.userNumber) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleTyping = (sender) => {
      if (sender === contact.userNumber) setIsTyping(true);
    };

    const handleStopTyping = (sender) => {
      if (sender === contact.userNumber) setIsTyping(false);
    };

    socket.on("receiveMessage", handleReceive);
    socket.on("messageSent", handleSent);
    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);

    return () => {
      socket.off("receiveMessage", handleReceive);
      socket.off("messageSent", handleSent);
      socket.off("userTyping", handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
    };
  }, [socket, contact, user.userNumber, markRead]);

  const handleSend = (content) => {
    sendMessage(contact.userNumber, content);
  };

  if (!contact) return null;

  const isOnline = onlineUsers.includes(contact.userNumber);

  return (
    <motion.div
      className="chat-window"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="chat-window__header">
        <div className="chat-window__header-info">
          <div className="chat-window__avatar">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="chat-window__name">{contact.name}</h2>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.span
                  key="typing"
                  className="chat-window__status chat-window__status--typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  typing...
                </motion.span>
              ) : (
                <motion.span
                  key="status"
                  className={`chat-window__status ${isOnline ? "chat-window__status--online" : ""}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {isOnline ? "Online" : "Offline"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="chat-window__messages" ref={messagesContainerRef}>
        {loading ? (
          <div className="chat-window__loading">
            <div className="chat-window__spinner" />
          </div>
        ) : messages.length === 0 ? (
          <p className="chat-window__no-messages">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={`${msg.timestamp}-${i}`}
              message={msg}
              isOwn={msg.sender === user.userNumber}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSend={handleSend}
        onTyping={() => emitTyping(contact.userNumber)}
        onStopTyping={() => emitStopTyping(contact.userNumber)}
      />
    </motion.div>
  );
};

export default ChatWindow;
