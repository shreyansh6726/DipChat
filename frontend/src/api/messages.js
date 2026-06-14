import api from "./axios";

export const getMessages = (sender, receiver, page = 1, limit = 50) =>
  api.get("/api/messages", {
    params: { sender, receiver, page, limit },
  });

export const markAsRead = (sender, receiver) =>
  api.put("/api/messages/read", { sender, receiver });
