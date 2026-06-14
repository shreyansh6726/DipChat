const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/users");
const Contact = require("../models/contact");

const signup = async (req, res) => {
  try {
    const { name, userId, email, password } = req.body;

    if (!name || !userId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existingUserId = await User.findOne({ userId });

    if (existingUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID already exists"
      });
    }

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    let userNumber = 1;

    while (await User.findOne({ userNumber })) {
      userNumber++;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      userNumber,
      name,
      userId,
      email,
      password: hashedPassword
    });

    await Contact.create({
      userNumber,
      contacts: []
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { credential, password } = req.body;

    const user = await User.findOne({
      $or: [
        { userId: credential },
        { email: credential }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        userNumber: user.userNumber
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        userNumber: user.userNumber,
        name: user.name,
        userId: user.userId,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      userNumber: req.user.userNumber
    }).select("-password");

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, userId, email } = req.body;

    const user = await User.findOne({
      userNumber: req.user.userNumber
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.name = name;
    user.userId = userId;
    user.email = email;

    await user.save();

    res.status(200).json({
      success: true,
      user: {
        userNumber: user.userNumber,
        name: user.name,
        userId: user.userId,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile
};