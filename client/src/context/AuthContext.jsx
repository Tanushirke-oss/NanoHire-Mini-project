import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deleteUserAccount, getMe, getUsers, login, loginWithGoogle, register } from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "nanohire_token";
const USER_KEY = "nanohire_current_user";
const USERS_KEY = "nanohire_users_cache";
const RESET_MARKER_KEY = "nanohire_reset_marker";
const RESET_MARKER_VALUE = "fresh_start_dark_reset_2026_03_22";

function applyFreshStartReset() {
  try {
    if (typeof window === "undefined") return;
    const marker = localStorage.getItem(RESET_MARKER_KEY);
    if (marker === RESET_MARKER_VALUE) return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("nanohire_")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(RESET_MARKER_KEY, RESET_MARKER_VALUE);
  } catch (_error) {
    // Ignore storage access errors and continue app bootstrap.
  }
}

applyFreshStartReset();

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

  async function signInWithGoogle(payload) {
    const { expectedRole, ...requestPayload } = payload || {};
    const response = await loginWithGoogle(requestPayload);

    if (expectedRole && response.user?.role !== expectedRole) {
      throw new Error(
        `This Google account is registered as ${response.user?.role}. Switch to ${response.user?.role} login.`
      );
    }

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

  async function deleteAccount() {
    if (!currentUser?.id) return;

    await deleteUserAccount(currentUser.id);
    signOut();
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
        signInWithGoogle,
        signUp,
        signOut,
        deleteAccount,
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
