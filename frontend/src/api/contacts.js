import api from "./axios";

export const getContacts = (userNumber) =>
  api.get(`/api/contacts/${userNumber}`);

export const addContact = (targetUserId) =>
  api.post("/api/contacts/add", { targetUserId });

export const removeContact = (userNumber, targetUser) =>
  api.delete("/api/contacts/remove", { data: { userNumber, targetUser } });
