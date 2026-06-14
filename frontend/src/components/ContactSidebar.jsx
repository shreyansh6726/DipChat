import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { getContacts, addContact } from "../api/contacts";
import ContactItem from "./ContactItem";
import AddContactModal from "./AddContactModal";
import "./ContactSidebar.css";

const ContactSidebar = ({ activeContact, onSelectContact }) => {
  const { user, logout } = useAuth();
  const { onlineUsers } = useSocket();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchContacts = useCallback(async () => {
    try {
      const { data } = await getContacts(user.userNumber);
      if (data.success) {
        setContacts(data.contacts);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [user.userNumber]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAddContact = async (targetUserId) => {
    setAddLoading(true);
    setAddError("");
    try {
      const { data } = await addContact(user.userNumber, targetUserId);
      if (data.success) {
        setModalOpen(false);
        await fetchContacts();
      }
    } catch (err) {
      setAddError(err.response?.data?.message || "Failed to add contact");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <aside className="contact-sidebar">
      <div className="contact-sidebar__header">
        <div className="contact-sidebar__user">
          <div className="contact-sidebar__avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="contact-sidebar__user-info">
            <span className="contact-sidebar__user-name">{user.name}</span>
            <span className="contact-sidebar__user-id">@{user.userId}</span>
          </div>
        </div>
        <button className="contact-sidebar__logout" onClick={logout} title="Logout">
          ↪
        </button>
      </div>

      <div className="contact-sidebar__actions">
        <motion.button
          className="contact-sidebar__add-btn"
          onClick={() => { setModalOpen(true); setAddError(""); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          + Add Contact
        </motion.button>
      </div>

      <div className="contact-sidebar__list">
        {loading ? (
          <div className="contact-sidebar__loading">
            <div className="contact-sidebar__spinner" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="contact-sidebar__empty">No contacts yet</p>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {contacts.map((contact) => (
              <ContactItem
                key={contact.userNumber}
                contact={contact}
                isActive={activeContact?.userNumber === contact.userNumber}
                isOnline={onlineUsers.includes(contact.userNumber)}
                onClick={() => onSelectContact(contact)}
              />
            ))}
          </motion.div>
        )}
      </div>

      <AddContactModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddContact}
        loading={addLoading}
        error={addError}
      />
    </aside>
  );
};

export default ContactSidebar;
