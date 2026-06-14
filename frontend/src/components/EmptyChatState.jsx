import { motion } from "framer-motion";
import "./EmptyChatState.css";

const EmptyChatState = () => {
  return (
    <motion.div
      className="empty-chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="empty-chat__icon"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        ◈
      </motion.div>
      <h2 className="empty-chat__title">DipChat</h2>
      <p className="empty-chat__desc">
        Select a contact from the sidebar to start chatting
      </p>
    </motion.div>
  );
};

export default EmptyChatState;
