import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  userNumber: { type: Number, unique: true, required: true },
  contacts: [{ type: Number }]
});

export const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

export const ContactModel = {
  // Get the contact list (int array) of a user
  getContacts: async (userNumber) => {
    const num = parseInt(userNumber, 10);
    const entry = await Contact.findOne({ userNumber: num });
    return entry ? entry.contacts : [];
  },

  // Add a contact to a user's contact book
  addContact: async (userNumber, contactUserNumber) => {
    const ownerNum = parseInt(userNumber, 10);
    const targetNum = parseInt(contactUserNumber, 10);

    // Get or create contact document for userNumber
    let entry = await Contact.findOne({ userNumber: ownerNum });
    if (!entry) {
      entry = new Contact({ userNumber: ownerNum, contacts: [] });
    }

    // Add target if not already present (idempotent operation)
    if (!entry.contacts.includes(targetNum)) {
      entry.contacts.push(targetNum);
    }
    await entry.save();

    // Also auto-add userNumber to contactUserNumber's contact list for symmetrical chat availability
    let reverseEntry = await Contact.findOne({ userNumber: targetNum });
    if (!reverseEntry) {
      reverseEntry = new Contact({ userNumber: targetNum, contacts: [] });
    }
    if (!reverseEntry.contacts.includes(ownerNum)) {
      reverseEntry.contacts.push(ownerNum);
    }
    await reverseEntry.save();

    return entry.contacts;
  },

  // Remove a contact from a user's list
  removeContact: async (userNumber, contactUserNumber) => {
    const ownerNum = parseInt(userNumber, 10);
    const targetNum = parseInt(contactUserNumber, 10);

    const entry = await Contact.findOne({ userNumber: ownerNum });
    if (entry) {
      entry.contacts = entry.contacts.filter(num => num !== targetNum);
      await entry.save();
    }

    const reverseEntry = await Contact.findOne({ userNumber: targetNum });
    if (reverseEntry) {
      reverseEntry.contacts = reverseEntry.contacts.filter(num => num !== ownerNum);
      await reverseEntry.save();
    }

    return entry ? entry.contacts : [];
  }
};
