import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userNumber: { type: Number, unique: true, required: true },
  name: { type: String, required: true },
  userId: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export const UserModel = {
  // Checks if a given user number is already in use
  isUserNumberAvailable: async (userNumber) => {
    const num = parseInt(userNumber, 10);
    const count = await User.countDocuments({ userNumber: num });
    return count === 0;
  },

  // Checks if a given username / user ID is available
  isUserIdAvailable: async (userId) => {
    const cleanId = String(userId).trim().toLowerCase();
    const count = await User.countDocuments({ userId: { $regex: new RegExp(`^${cleanId}$`, 'i') } });
    return count === 0;
  },

  // Creates a new user with proper validation checks
  create: async (name, userId, email, password) => {
    // 1. Determine next user number in ascending order starting at 1
    const maxUser = await User.findOne().sort({ userNumber: -1 });
    let num = maxUser ? maxUser.userNumber + 1 : 1;

    // Double check availability
    while (!(await UserModel.isUserNumberAvailable(num))) {
      num++;
    }

    // 2. Double check username availability
    const cleanId = String(userId).trim();
    const existing = await User.findOne({ userId: { $regex: new RegExp(`^${cleanId}$`, 'i') } });
    if (existing) {
      throw new Error(`Username (user id) "${cleanId}" is already taken`);
    }

    const newUser = new User({
      userNumber: num,
      name: String(name).trim(),
      userId: cleanId,
      email: String(email).trim(),
      password: String(password)
    });

    await newUser.save();
    return newUser;
  },

  // Find a user by userNumber
  findByUserNumber: async (userNumber) => {
    const num = parseInt(userNumber, 10);
    return await User.findOne({ userNumber: num });
  },

  // Find a user by userId (username) or email
  findByEmailOrId: async (credential) => {
    const cleanCred = String(credential).trim().toLowerCase();
    return await User.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${cleanCred}$`, 'i') } },
        { userId: { $regex: new RegExp(`^${cleanCred}$`, 'i') } }
      ]
    });
  },

  // Retrieve all users
  getAll: async () => {
    return await User.find({});
  }
};
