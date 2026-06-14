import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import "./MessageInput.css";

const MessageInput = ({ onSend, onTyping, onStopTyping, disabled }) => {
  const [text, setText] = useState("");
  const typingTimeout = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping?.();
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onStopTyping?.(), 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    onStopTyping?.();
    clearTimeout(typingTimeout.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    return () => clearTimeout(typingTimeout.current);
  }, []);

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        className="message-input__field"
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <motion.button
        type="submit"
        className="message-input__send"
        disabled={!text.trim() || disabled}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.button>
    </form>
  );
};

export default MessageInput;
