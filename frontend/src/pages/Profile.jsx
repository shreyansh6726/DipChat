import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "./Profile.css";

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  const [form, setForm] = useState({
    name: user.name,
    userId: user.userId,
    email: user.email
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async () => {
    try {
      const { data } = await api.put("/api/auth/profile", form);

      if (data.success) {
        updateUser(data.user);
        alert("Profile updated");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="profile">
      <h1>Profile</h1>

      <input
        name="name"
        value={form.name}
        onChange={handleChange}
      />

      <input
        name="userId"
        value={form.userId}
        onChange={handleChange}
      />

      <input
        name="email"
        value={form.email}
        onChange={handleChange}
      />

      <button onClick={handleSave}>
        Save Changes
      </button>

      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Profile;