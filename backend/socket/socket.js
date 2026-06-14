const Messages = require("../models/messages");

const onlineUsers = new Map();

const initializeSocket = (io) => {

  io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    socket.on("register", (userNumber) => {
      onlineUsers.set(userNumber, socket.id);

      io.emit("onlineUsers", [...onlineUsers.keys()]);
    });

    socket.on("sendMessage", async (data) => {
      try {

        const { sender, receiver, content } = data;

        const connection = [sender, receiver].sort((a, b) => a - b);

        let chat = await Messages.findOne({
          connection
        });

        if (!chat) {
          chat = await Messages.create({
            connection,
            messageList: []
          });
        }

        const message = {
          sender,
          content,
          timestamp: Date.now(),
          status: "unread"
        };

        chat.messageList.push(message);

        await chat.save();

        const receiverSocket = onlineUsers.get(receiver);

        if (receiverSocket) {
          io.to(receiverSocket).emit("receiveMessage", message);
        }

        socket.emit("messageSent", message);

      } catch (error) {

        socket.emit("messageError", {
          message: error.message
        });

      }
    });

    socket.on("typing", ({ sender, receiver }) => {

      const receiverSocket = onlineUsers.get(receiver);

      if (receiverSocket) {
        io.to(receiverSocket).emit("userTyping", sender);
      }

    });

    socket.on("stopTyping", ({ sender, receiver }) => {

      const receiverSocket = onlineUsers.get(receiver);

      if (receiverSocket) {
        io.to(receiverSocket).emit("userStoppedTyping", sender);
      }

    });

    socket.on("markRead", async ({ sender, receiver }) => {

      try {

        const connection = [sender, receiver].sort((a, b) => a - b);

        const chat = await Messages.findOne({
          connection
        });

        if (chat) {

          chat.messageList.forEach(message => {

            if (message.sender === receiver) {
              message.status = "read";
            }

          });

          await chat.save();
        }

      } catch (error) {

        socket.emit("messageError", {
          message: error.message
        });

      }

    });

    socket.on("disconnect", () => {

      for (const [userNumber, socketId] of onlineUsers.entries()) {

        if (socketId === socket.id) {
          onlineUsers.delete(userNumber);
          break;
        }

      }

      io.emit("onlineUsers", [...onlineUsers.keys()]);

      console.log("User disconnected:", socket.id);

    });

  });

};

module.exports = initializeSocket;