const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    userNumber: {
      type: Number,
      required: true,
      unique: true
    },

    contacts: [
      {
        type: Number
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Contact", contactSchema);