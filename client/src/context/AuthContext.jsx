import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deleteUserAccount, getMe, getUsers, login, loginWithGoogle, register } from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "nanohire_token";
const USER_KEY = "nanohire_current_user";
const USERS_KEY = "nanohire_users_cache";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  async function refreshSessionUser() {
    if (!token) return null;
    try {
      const me = await getMe();
      setCurrentUser(me.user);
      return me.user;
    } catch (_error) {
      // Keep current session state when a transient request fails.
      return currentUser;
    }
  }

  useEffect(() => {
    async function bootAuth() {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        let me;
        try {
          me = await getMe();
        } catch (_error) {
          // Retry once for transient startup/network race in local dev.
          await sleep(400);
          me = await getMe();
        }

        setCurrentUser(me.user);
        try {
          await refreshUsers();
        } catch (_error) {
          // User list can be refreshed later.
        }
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
    setAuthLoading(true);
    try {
      const response = await login(payload);

      if (expectedRole && response.user?.role !== expectedRole) {
        throw new Error(
          `This account is registered as ${response.user?.role}. Switch to ${response.user?.role} login.`
        );
      }

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);

      let finalUser = response.user;
      try {
        const me = await getMe();
        finalUser = me.user;
        setCurrentUser(me.user);
      } catch (_error) {
        // Keep login successful even if hydration call fails momentarily.
      }

      try {
        await refreshUsers();
      } catch (_error) {
        // User list can be refreshed later.
      }

      return finalUser;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUp(payload) {
    setAuthLoading(true);
    try {
      const response = await register(payload);
      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);

      let finalUser = response.user;
      try {
        const me = await getMe();
        finalUser = me.user;
        setCurrentUser(me.user);
      } catch (_error) {
        // Keep signup successful even if hydration call fails momentarily.
      }

      try {
        await refreshUsers();
      } catch (_error) {
        // User list can be refreshed later.
      }

      return finalUser;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInWithGoogle(payload) {
    const { expectedRole, ...requestPayload } = payload || {};
    setAuthLoading(true);
    try {
      const response = await loginWithGoogle(requestPayload);

      if (expectedRole && response.user?.role !== expectedRole) {
        throw new Error(
          `This Google account is registered as ${response.user?.role}. Switch to ${response.user?.role} login.`
        );
      }

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);

      let finalUser = response.user;
      try {
        const me = await getMe();
        finalUser = me.user;
        setCurrentUser(me.user);
      } catch (_error) {
        // Keep Google login successful even if hydration call fails momentarily.
      }

      try {
        await refreshUsers();
      } catch (_error) {
        // User list can be refreshed later.
      }

      return finalUser;
    } finally {
      setAuthLoading(false);
    }
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
        refreshSessionUser,
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
