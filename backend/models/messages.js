import mongoose from 'mongoose';

const messageItemSchema = new mongoose.Schema({
  sender: { type: Number, required: true },
  content: { type: String, required: true },
  timestamp: { type: Number, required: true },
  status: { type: String, enum: ['unread', 'read'], default: 'unread' }
});

const messageSchema = new mongoose.Schema({
  connection: { type: [Number], required: true }, // [low, high]
  messageList: [messageItemSchema]
});

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

/**
 * Normalizes two user numbers into a standard order-independent connection key.
 * For example, user number 5 and 2 always map to connection [2, 5].
 */
export function getConnectionKey(userNum1, userNum2) {
  const n1 = parseInt(userNum1, 10);
  const n2 = parseInt(userNum2, 10);
  return n1 < n2 ? [n1, n2] : [n2, n1];
}

export const MessageModel = {
  // Retrieve paginated messages for a connection
  getMessages: async (userNum1, userNum2, page = 1, limit = 20) => {
    const [low, high] = getConnectionKey(userNum1, userNum2);

    const connection = await Message.findOne({
      connection: { $all: [low, high] }
    });

    if (!connection || !connection.messageList) {
      return {
        messages: [],
        hasMore: false,
        totalCount: 0
      };
    }

    const list = connection.messageList;
    const totalCount = list.length;
    
    // Paginate starting from the end of the array (most recent messages)
    // Page 1: last 20 messages, Page 2: the 20 messages before that, etc.
    const startIndex = Math.max(0, totalCount - (page * limit));
    const endIndex = Math.max(0, totalCount - ((page - 1) * limit));

    const messages = list.slice(startIndex, endIndex);

    return {
      messages, // chronological array of the requested page slice
      hasMore: startIndex > 0,
      totalCount
    };
  },

  // Save a new message
  addMessage: async (sender, receiver, content, timestamp, status = 'unread') => {
    const sNum = parseInt(sender, 10);
    const rNum = parseInt(receiver, 10);
    const [low, high] = getConnectionKey(sNum, rNum);

    let connection = await Message.findOne({
      connection: { $all: [low, high] }
    });

    if (!connection) {
      connection = new Message({
        connection: [low, high],
        messageList: []
      });
    }

    const newMessage = {
      sender: sNum,
      content: String(content),
      timestamp: parseInt(timestamp, 10) || Date.now(),
      status: String(status) // 'unread' or 'read'
    };

    connection.messageList.push(newMessage);
    await connection.save();
    return newMessage;
  },

  // Mark all messages as read in this connection
  markAsRead: async (receiver, sender) => {
    const rNum = parseInt(receiver, 10);
    const sNum = parseInt(sender, 10);
    const [low, high] = getConnectionKey(rNum, sNum);

    const connection = await Message.findOne({
      connection: { $all: [low, high] }
    });

    if (connection && connection.messageList) {
      connection.messageList.forEach(m => {
        if (m.sender === sNum) {
          m.status = 'read';
        }
      });
      await connection.save();
    }
  }
};
