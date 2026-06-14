import { motion } from "framer-motion";
import "./ContactItem.css";

const getInitials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const ContactItem = ({ contact, isActive, isOnline, onClick }) => {
  return (
    <motion.button
      className={`contact-item ${isActive ? "contact-item--active" : ""}`}
      onClick={onClick}
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: "var(--bg-hover)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="contact-item__avatar">
        <span>{getInitials(contact.name)}</span>
        {isOnline && <span className="contact-item__online" />}
      </div>
      <div className="contact-item__info">
        <span className="contact-item__name">{contact.name}</span>
        <span className="contact-item__id">@{contact.userId}</span>
      </div>
      {isActive && (
        <motion.div
          className="contact-item__indicator"
          layoutId="activeContact"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
};

export default ContactItem;
