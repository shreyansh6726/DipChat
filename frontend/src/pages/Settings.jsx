import { useTheme } from "../context/ThemeContext";
import "./Settings.css";

const Settings = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="settings">
      <h1>Appearance</h1>

      <button
        className={theme === "light" ? "active" : ""}
        onClick={() => setTheme("light")}
      >
        Light Mode
      </button>

      <button
        className={theme === "dark" ? "active" : ""}
        onClick={() => setTheme("dark")}
      >
        Dark Mode
      </button>

      <button
        className={theme === "system" ? "active" : ""}
        onClick={() => setTheme("system")}
      >
        System Theme
      </button>
    </div>
  );
};

export default Settings;