const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: Number,
    required: true
  },

  content: {
    type: String,
    required: true
  },

  timestamp: {
    type: Number,
    default: Date.now
  },

  status: {
    type: String,
    enum: ["read", "unread"],
    default: "unread"
  }
});

const messagesSchema = new mongoose.Schema(
  {
    connection: {
      type: [Number],
      required: true,
      validate: {
        validator: function (arr) {
          return arr.length === 2;
        }
      }
    },

    messageList: [messageSchema]
  },
  {
    timestamps: true
  }
);

messagesSchema.index({ connection: 1 });

module.exports = mongoose.model("Messages", messagesSchema);