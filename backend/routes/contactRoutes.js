const express = require("express");

const {
  addContact,
  removeContact,
  getContacts
} = require("../controllers/contactController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/add", authMiddleware, addContact);

router.delete("/remove", authMiddleware, removeContact);

router.get("/:userNumber", authMiddleware, getContacts);

module.exports = router;