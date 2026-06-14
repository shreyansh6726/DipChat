import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <div className="landing__bg" />

      <motion.div
        className="landing__content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          className="landing__logo"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <span className="landing__logo-icon">◈</span>
        </motion.div>

        <motion.h1
          className="landing__title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          DipChat
        </motion.h1>

        <motion.p
          className="landing__tagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Simple. Private. Real-time.
        </motion.p>

        <motion.button
          className="landing__cta"
          onClick={() => navigate("/auth")}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          whileHover={{ scale: 1.03, boxShadow: "0 0 40px var(--accent-glow)" }}
          whileTap={{ scale: 0.97 }}
        >
          Get Started
          <span className="landing__cta-arrow">→</span>
        </motion.button>
      </motion.div>

      <motion.p
        className="landing__footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        Connect with anyone, anywhere
      </motion.p>
    </div>
  );
};

export default LandingPage;
