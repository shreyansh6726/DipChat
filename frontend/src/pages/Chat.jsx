import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ContactSidebar from "../components/ContactSidebar";
import ChatWindow from "../components/ChatWindow";
import EmptyChatState from "../components/EmptyChatState";
import "./Chat.css";

const Chat = () => {
  const [activeContact, setActiveContact] = useState(null);

  return (
    <div className="chat-layout">
      <ContactSidebar
        activeContact={activeContact}
        onSelectContact={setActiveContact}
      />
      <main className="chat-layout__main">
        <AnimatePresence mode="wait">
          {activeContact ? (
            <ChatWindow key={activeContact.userNumber} contact={activeContact} />
          ) : (
            <EmptyChatState key="empty" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Chat;
