const User = require("../models/users");
const Contact = require("../models/contact");

const addContact = async (req, res) => {
  try {
    const { userNumber, targetUser } = req.body;

    if (!userNumber || !targetUser) {
      return res.status(400).json({
        success: false,
        message: "Missing fields"
      });
    }

    const userExists = await User.findOne({
      userNumber: targetUser
    });

    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const contactBook = await Contact.findOne({
      userNumber
    });

    if (!contactBook) {
      return res.status(404).json({
        success: false,
        message: "Contact book not found"
      });
    }

    if (contactBook.contacts.includes(targetUser)) {
      return res.status(400).json({
        success: false,
        message: "Already added"
      });
    }

    contactBook.contacts.push(targetUser);

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
    const { userNumber, targetUser } = req.body;

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
      contact => contact !== targetUser
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
    const { userNumber } = req.params;

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