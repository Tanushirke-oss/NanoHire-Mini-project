import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, getUsers, login, register } from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "nanohire_token";
const USER_KEY = "nanohire_current_user";
const USERS_KEY = "nanohire_users_cache";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => readJSON(USERS_KEY, []));
  const [currentUser, setCurrentUser] = useState(() => readJSON(USER_KEY, null));
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [authLoading, setAuthLoading] = useState(true);

  async function refreshUsers() {
    const data = await getUsers();
    setUsers(data);
  }

  useEffect(() => {
    async function bootAuth() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const me = await getMe();
        setCurrentUser(me.user);
        await refreshUsers();
      } catch (_error) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(USERS_KEY);
        setToken("");
        setCurrentUser(null);
        setUsers([]);
      } finally {
        setAuthLoading(false);
      }
    }

    bootAuth();
  }, [token]);

  async function signIn(credentials) {
    const { expectedRole, ...payload } = credentials;
    const response = await login(payload);

    if (expectedRole && response.user?.role !== expectedRole) {
      throw new Error(
        `This account is registered as ${response.user?.role}. Switch to ${response.user?.role} login.`
      );
    }

    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setCurrentUser(response.user);
    await refreshUsers();
    return response.user;
  }

  async function signUp(payload) {
    const response = await register(payload);
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setCurrentUser(response.user);
    await refreshUsers();
    return response.user;
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USERS_KEY);
    setToken("");
    setCurrentUser(null);
    setUsers([]);
  }

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
  }, [users]);

  const isAuthenticated = useMemo(() => !!currentUser && !!token, [currentUser, token]);

  return (
    <AuthContext.Provider
      value={{
        users,
        currentUser,
        token,
        isAuthenticated,
        authLoading,
        signIn,
        signUp,
        signOut,
        refreshUsers,
        setUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
