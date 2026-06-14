const User = require("../models/users");
const Contact = require("../models/contact");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveTargetUserNumber = async (targetUserId, targetUser) => {
  if (targetUser !== undefined && targetUser !== null && targetUser !== "") {
    const byNumber = await User.findOne({
      userNumber: Number(targetUser)
    });
    if (byNumber) return byNumber.userNumber;
  }

  if (!targetUserId) return null;

  const normalized = String(targetUserId).trim().replace(/^@+/, "");
  if (!normalized) return null;

  let user = await User.findOne({ userId: normalized });

  if (!user) {
    user = await User.findOne({
      userId: {
        $regex: new RegExp(`^${escapeRegex(normalized)}$`, "i")
      }
    });
  }

  if (!user && /^\d+$/.test(normalized)) {
    user = await User.findOne({ userNumber: Number(normalized) });
  }

  return user ? user.userNumber : null;
};

const addContact = async (req, res) => {
  try {
    const { targetUser, targetUserId } = req.body;
    const userNumber = Number(req.user?.userNumber ?? req.body.userNumber);

    if (!userNumber || Number.isNaN(userNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session. Please log in again."
      });
    }

    if (!targetUser && !targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Enter a User ID to add"
      });
    }

    const resolvedTargetUser = await resolveTargetUserNumber(
      targetUserId,
      targetUser
    );

    if (!resolvedTargetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found. Check the User ID and try again."
      });
    }

    if (resolvedTargetUser === userNumber) {
      return res.status(400).json({
        success: false,
        message: "You cannot add yourself as a contact"
      });
    }

    const contactBook = await Contact.findOne({ userNumber });

    if (!contactBook) {
      return res.status(404).json({
        success: false,
        message: "Contact book not found"
      });
    }

    if (contactBook.contacts.includes(resolvedTargetUser)) {
      return res.status(400).json({
        success: false,
        message: "This contact is already in your list"
      });
    }

    contactBook.contacts.push(resolvedTargetUser);
    await contactBook.save();

    res.status(200).json({
      success: true,
      message: "Contact added"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const removeContact = async (req, res) => {
  try {
    const { targetUser } = req.body;
    const userNumber = Number(req.user?.userNumber ?? req.body.userNumber);

    const contactBook = await Contact.findOne({
      userNumber
    });

    if (!contactBook) {
      return res.status(404).json({
        success: false,
        message: "Contact book not found"
      });
    }

    contactBook.contacts = contactBook.contacts.filter(
      (contact) => contact !== Number(targetUser)
    );

    await contactBook.save();

    res.status(200).json({
      success: true,
      message: "Contact removed"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getContacts = async (req, res) => {
  try {
    const userNumber = Number(req.user?.userNumber ?? req.params.userNumber);

    const contactBook = await Contact.findOne({
      userNumber
    });

    if (!contactBook) {
      return res.status(404).json({
        success: false,
        message: "Contact book not found"
      });
    }

    const users = await User.find({
      userNumber: {
        $in: contactBook.contacts
      }
    }).select("-password");

    res.status(200).json({
      success: true,
      contacts: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  addContact,
  removeContact,
  getContacts
};
