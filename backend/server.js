require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const messageRoutes = require("./routes/messageRoutes");

const errorMiddleware = require("./middleware/errorMiddleware");

const initializeSocket = require("./socket/socket");

const app = express();

connectDB();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.CLIENT_URL
    ],
    credentials: true
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running"
  });
});

app.use("/api/auth", authRoutes);

app.use("/api/contacts", contactRoutes);

app.use("/api/messages", messageRoutes);

app.use(errorMiddleware);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  }
});

initializeSocket(io);

const PORT = process.env.PORT || 7860;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});