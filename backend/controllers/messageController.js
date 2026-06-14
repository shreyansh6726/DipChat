const Messages = require("../models/messages");

const sendMessage = async (req, res) => {
  try {
    const { sender, receiver, content } = req.body;

    let connection = [sender, receiver].sort((a, b) => a - b);

    let chat = await Messages.findOne({
      connection
    });

    if (!chat) {
      chat = await Messages.create({
        connection,
        messageList: []
      });
    }

    chat.messageList.push({
      sender,
      content,
      timestamp: Date.now(),
      status: "unread"
    });

    await chat.save();

    res.status(200).json({
      success: true,
      message: "Message sent"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const sender = Number(req.query.sender);
    const receiver = Number(req.query.receiver);

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const connection = [sender, receiver].sort((a, b) => a - b);

    const chat = await Messages.findOne({
      connection
    });

    if (!chat) {
      return res.status(200).json({
        success: true,
        messages: []
      });
    }

    const totalMessages = chat.messageList.length;

    const start = Math.max(
      totalMessages - page * limit,
      0
    );

    const end = totalMessages - (page - 1) * limit;

    const messages = chat.messageList.slice(start, end);

    res.status(200).json({
      success: true,
      page,
      limit,
      totalMessages,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { sender, receiver } = req.body;

    const connection = [sender, receiver].sort((a, b) => a - b);

    const chat = await Messages.findOne({
      connection
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    chat.messageList.forEach(message => {
      if (message.sender !== sender) {
        message.status = "read";
      }
    });

    await chat.save();

    res.status(200).json({
      success: true,
      message: "Messages marked as read"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markAsRead
};