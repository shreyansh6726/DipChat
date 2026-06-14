import api from "./axios";

export const getContacts = (userNumber) =>
  api.get(`/api/contacts/${userNumber}`);

export const addContact = (userNumber, targetUserId) =>
  api.post("/api/contacts/add", { userNumber, targetUserId });

export const removeContact = (userNumber, targetUser) =>
  api.delete("/api/contacts/remove", { data: { userNumber, targetUser } });
