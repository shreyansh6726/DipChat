import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const storedToken =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  const storedUser =
    localStorage.getItem("user") || sessionStorage.getItem("user");

  if (storedToken && storedUser) {
    setToken(storedToken);
    setUser(JSON.parse(storedUser));
  }

  setLoading(false);
  }, []);

  const login = useCallback((newToken, newUser, persistent) => {
  if (persistent) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  } else {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));

    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  setToken(newToken);
  setUser(newUser);
  }, []);

  const updateUser = useCallback((newUser) => {
    setUser(newUser);

    if (localStorage.getItem("user")) {
      localStorage.setItem("user", JSON.stringify(newUser));
    }

    if (sessionStorage.getItem("user")) {
      sessionStorage.setItem("user", JSON.stringify(newUser));
    }
  }, []);

  const logout = useCallback(() => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");

  setToken(null);
  setUser(null);
}, []);

  return (
    <AuthContext.Provider
  value={{
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!token
  }}
>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
