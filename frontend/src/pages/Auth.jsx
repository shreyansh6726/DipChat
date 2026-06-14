import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { signup, login } from "../api/auth";
import "./Auth.css";

const Auth = () => {
  const navigate = useNavigate();
  const { login: authLogin, isAuthenticated } = useAuth();
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const [loginForm, setLoginForm] = useState({ credential: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "",
    userId: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await login(loginForm);
      if (data.success) {
        authLogin(data.token, data.user, keepLoggedIn);
        navigate("/chat");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const { data } = await signup(signupForm);
      if (data.success) {
        setSuccess("Account created! You can now log in.");
        setMode("login");
        setLoginForm({ credential: signupForm.userId, password: "" });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__bg" />

      <motion.div
        className="auth__card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <button className="auth__back" onClick={() => navigate("/")}>
          ← Back
        </button>

        <h1 className="auth__title">Welcome</h1>
        <p className="auth__subtitle">
          {mode === "login" ? "Sign in to continue" : "Create your account"}
        </p>

        <div className="auth__toggle">
          <motion.div
            className="auth__toggle-pill"
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ left: mode === "login" ? "4px" : "calc(50% + 0px)" }}
          />
          <button
            className={`auth__toggle-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
          >
            Login
          </button>
          <button
            className={`auth__toggle-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
          >
            Sign Up
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              className="auth__form"
              onSubmit={handleLogin}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="auth__field">
                <label htmlFor="credential">User ID or Email</label>
                <input
                  id="credential"
                  type="text"
                  placeholder="Enter your user ID or email"
                  value={loginForm.credential}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, credential: e.target.value })
                  }
                  required
                />
              </div>
              <div className="auth__field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  required
                />
              </div>
              <div className="auth__remember">
                <input
                  type="checkbox"
                  id="remember"
                  checked={keepLoggedIn}
                  onChange={() => setKeepLoggedIn(!keepLoggedIn)}
                />

                <label htmlFor="remember">
                  Keep me logged in
                </label>
              </div>
              <motion.button
                type="submit"
                className="auth__submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              className="auth__form"
              onSubmit={handleSignup}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="auth__field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your display name"
                  value={signupForm.name}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="auth__field">
                <label htmlFor="userId">User ID</label>
                <input
                  id="userId"
                  type="text"
                  placeholder="Choose a unique user ID"
                  value={signupForm.userId}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, userId: e.target.value })
                  }
                  required
                />
              </div>
              <div className="auth__field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={signupForm.email}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="auth__field">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={signupForm.password}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, password: e.target.value })
                  }
                  required
                />
              </div>
              <motion.button
                type="submit"
                className="auth__submit"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? "Creating..." : "Create Account"}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.p
              className="auth__message auth__message--error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              className="auth__message auth__message--success"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {success}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Auth;
