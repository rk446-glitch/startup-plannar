import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  checkCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
} from "../services/authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");
  const [sessionError, setSessionError] = useState("");

  const refreshUser = useCallback(async () => {
    setStatus("checking");
    setSessionError("");
    try {
      const currentUser = await checkCurrentUser();
      setUser(currentUser);
      setStatus(currentUser ? "authenticated" : "anonymous");
      return currentUser;
    } catch (error) {
      setUser(null);
      setStatus("error");
      setSessionError(error.message);
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    checkCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "anonymous");
      })
      .catch((error) => {
        if (!active) return;
        setSessionError(error.message);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      setUser(null);
      setStatus("anonymous");
      setSessionError("");
    }
    window.addEventListener("foundry:session-expired", handleExpiredSession);
    return () => window.removeEventListener("foundry:session-expired", handleExpiredSession);
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    sessionError,
    refreshUser,
    async register(values) {
      return registerAccount(values);
    },
    async login(values) {
      const loggedInUser = await loginAccount(values);
      setUser(loggedInUser);
      setSessionError("");
      setStatus("authenticated");
      return loggedInUser;
    },
    async logout() {
      await logoutAccount();
      setUser(null);
      setSessionError("");
      setStatus("anonymous");
    },
  }), [user, status, sessionError, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
