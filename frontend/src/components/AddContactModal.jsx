import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./AddContactModal.css";

const AddContactModal = ({ isOpen, onClose, onAdd, loading, error }) => {
  const [userId, setUserId] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userId.trim()) {
      onAdd(userId.trim());
    }
  };

  useEffect(() => {
    if (!isOpen) setUserId("");
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="add-contact-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
            <h3 className="add-contact-modal__title">Add Contact</h3>
            <p className="add-contact-modal__desc">
              Enter the User ID of the person you want to connect with.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                className="add-contact-modal__input"
                type="text"
                placeholder="e.g. johndoe"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoFocus
              />
              {error && (
                <p className="add-contact-modal__error">{error}</p>
              )}
              <div className="add-contact-modal__actions">
                <button type="button" className="add-contact-modal__cancel" onClick={onClose}>
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  className="add-contact-modal__submit"
                  disabled={loading || !userId.trim()}
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? "Adding..." : "Add"}
                </motion.button>
              </div>
            </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddContactModal;
