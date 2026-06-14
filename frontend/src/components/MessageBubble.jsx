import { motion } from "framer-motion";
import "./MessageBubble.css";

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageBubble = ({ message, isOwn }) => {
  return (
    <motion.div
      className={`message-bubble ${isOwn ? "message-bubble--own" : "message-bubble--other"}`}
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <p className="message-bubble__content">{message.content}</p>
      <span className="message-bubble__time">{formatTime(message.timestamp)}</span>
    </motion.div>
  );
};

export default MessageBubble;
