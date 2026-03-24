import axios from "axios";

const ENV_API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_LOCAL_API_URL = "http://localhost:4000";
const API_BASE_CACHE_KEY = "nanohire_api_base_url";
const LOCAL_SCAN_START = 4000;
const LOCAL_SCAN_END = 4010;

let resolvedApiBaseUrl = null;
let resolvingApiBaseUrlPromise = null;

function isLocalDevHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getCachedApiBaseUrl() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(API_BASE_CACHE_KEY);
}

function setCachedApiBaseUrl(url) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_BASE_CACHE_KEY, url);
}

async function probeApiHealth(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal
    });
    if (!response.ok) return false;

    const payload = await response.json();
    return payload?.status === "ok";
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function detectLocalApiBaseUrl() {
  const cached = getCachedApiBaseUrl();
  if (cached && (await probeApiHealth(cached, 800))) {
    return cached;
  }

  for (let port = LOCAL_SCAN_START; port <= LOCAL_SCAN_END; port += 1) {
    const candidate = `http://localhost:${port}`;
    // eslint-disable-next-line no-await-in-loop
    const healthy = await probeApiHealth(candidate);
    if (healthy) {
      setCachedApiBaseUrl(candidate);
      return candidate;
    }
  }

  return DEFAULT_LOCAL_API_URL;
}

async function resolveApiBaseUrl(forceRefresh = false) {
  if (ENV_API_URL) return ENV_API_URL;
  if (typeof window === "undefined") return DEFAULT_LOCAL_API_URL;

  const hostname = window.location.hostname;
  if (!isLocalDevHost(hostname)) {
    return DEFAULT_LOCAL_API_URL;
  }

  if (!forceRefresh && resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  if (!forceRefresh && resolvingApiBaseUrlPromise) {
    return resolvingApiBaseUrlPromise;
  }

  resolvingApiBaseUrlPromise = detectLocalApiBaseUrl()
    .then((url) => {
      resolvedApiBaseUrl = url;
      return url;
    })
    .finally(() => {
      resolvingApiBaseUrlPromise = null;
    });

  return resolvingApiBaseUrlPromise;
}

function shouldRetryWithReDetection(error) {
  if (ENV_API_URL) return false;
  if (typeof window === "undefined") return false;
  if (!isLocalDevHost(window.location.hostname)) return false;

  const requestConfig = error?.config;
  if (!requestConfig || requestConfig.__retriedWithPortRedetect) return false;

  return error?.code === "ERR_NETWORK";
}

function shouldRetryNetworkOnce(error) {
  const requestConfig = error?.config;
  if (!requestConfig || requestConfig.__retriedNetworkOnce) return false;
  return error?.code === "ERR_NETWORK";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const api = axios.create({
  baseURL: ENV_API_URL || DEFAULT_LOCAL_API_URL
});

api.interceptors.request.use(async (config) => {
  config.baseURL = await resolveApiBaseUrl();
  const token = localStorage.getItem("nanohire_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!shouldRetryWithReDetection(error)) {
      if (!shouldRetryNetworkOnce(error)) {
        return Promise.reject(error);
      }

      // Retry once to handle temporary API startup race conditions.
      await sleep(500);
      const retryConfig = {
        ...error.config,
        __retriedNetworkOnce: true
      };
      return api.request(retryConfig);
    }

    const retryConfig = {
      ...error.config,
      __retriedWithPortRedetect: true,
      baseURL: await resolveApiBaseUrl(true)
    };
    return api.request(retryConfig);
  }
);

export const register = async (payload) => (await api.post("/auth/register", payload)).data;
export const login = async (payload) => (await api.post("/auth/login", payload)).data;
export const loginWithGoogle = async (payload) => (await api.post("/auth/google", payload)).data;
export const getMe = async () => (await api.get("/auth/me")).data;

export const getUsers = async () => (await api.get("/users")).data;
export const getUser = async (userId) => (await api.get(`/users/${userId}`)).data;
export const getCurrentUser = async () => (await api.get("/users/me")).data;
export const updateUser = async (userId, payload) => (await api.put(`/users/${userId}`, payload)).data;
export const updateUserWallet = async (userId, payload) =>
  (await api.patch(`/users/${userId}/wallet`, payload)).data;
export const deleteUserAccount = async (userId) => (await api.delete(`/users/${userId}`)).data;
export const uploadUserFiles = async (userId, files) => {
  const formData = new FormData();
  if (files.resume) formData.append("resume", files.resume);
  if (files.portfolio) formData.append("portfolio", files.portfolio);

  return (
    await api.post(`/users/${userId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
  ).data;
};

export const getPosts = async () => (await api.get("/posts")).data;
export const createPost = async (payload) => {
  const formData = payload instanceof FormData ? payload : new FormData();

  if (!(payload instanceof FormData)) {
    const { title = "", body = "", content = "", mediaFile = null } = payload || {};
    formData.append("title", title);
    formData.append("body", body);
    formData.append("content", content);
    if (mediaFile) {
      formData.append("media", mediaFile);
    }
  }

  return (
    await api.post("/posts", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
  ).data;
};
export const deletePost = async (postId) => (await api.delete(`/posts/${postId}`)).data;
export const togglePostLike = async (postId) => (await api.post(`/posts/${postId}/like`)).data;
export const commentOnPost = async (postId, payload) => (await api.post(`/posts/${postId}/comment`, payload)).data;
export const sharePost = async (postId) => (await api.post(`/posts/${postId}/share`)).data;

export const getGigs = async () => (await api.get("/gigs")).data;
export const getGig = async (gigId) => (await api.get(`/gigs/${gigId}`)).data;
export const createGig = async (payload) => (await api.post("/gigs", payload)).data;
export const deleteGig = async (gigId) => (await api.delete(`/gigs/${gigId}`)).data;
export const setGigOnchain = async (gigId, payload) => (await api.post(`/gigs/${gigId}/onchain`, payload)).data;
export const applyGig = async (gigId, payload = {}) => {
  if (payload.resumeFile || payload.workSampleFile) {
    const formData = new FormData();
    if (payload.note) formData.append("note", payload.note);
    if (payload.resumeFile) formData.append("resume", payload.resumeFile);
    if (payload.workSampleFile) formData.append("workSample", payload.workSampleFile);
    if (payload.resumeUrl) formData.append("resumeUrl", payload.resumeUrl);

    return (
      await api.post(`/gigs/${gigId}/apply`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
    ).data;
  }

  return (await api.post(`/gigs/${gigId}/apply`, payload)).data;
};
export const selectApplicant = async (gigId, payload) => (await api.post(`/gigs/${gigId}/select`, payload)).data;
export const postUpdate = async (gigId, payload) => (await api.post(`/gigs/${gigId}/updates`, payload)).data;
export const postFeedback = async (gigId, payload) => (await api.post(`/gigs/${gigId}/feedback`, payload)).data;
export const submitGig = async (gigId, payload = {}) => {
  if (payload.deliverableFile) {
    const formData = new FormData();
    if (payload.studentId) formData.append("studentId", payload.studentId);
    if (payload.deliverableUrl) formData.append("deliverableUrl", payload.deliverableUrl);
    if (payload.note) formData.append("note", payload.note);
    if (payload.onchainTxHash) formData.append("onchainTxHash", payload.onchainTxHash);
    formData.append("deliverable", payload.deliverableFile);

    return (
      await api.post(`/gigs/${gigId}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
    ).data;
  }

  return (await api.post(`/gigs/${gigId}/submit`, payload)).data;
};
export const acceptGig = async (gigId, payload) => (await api.post(`/gigs/${gigId}/accept`, payload)).data;
export const raiseDispute = async (gigId, payload) => (await api.post(`/gigs/${gigId}/dispute`, payload)).data;
export const resolveDispute = async (gigId, payload) =>
  (await api.post(`/gigs/${gigId}/dispute/resolve`, payload)).data;
export const getDeveloperStats = async () => (await api.get("/gigs/dev/stats")).data;
export const getMessages = async () => (await api.get("/messages")).data;
export const getConversation = async (gigId, otherUserId) => 
  (await api.get(`/messages/${gigId}/${otherUserId}`)).data;
export const sendMessage = async (payload) => 
  (await api.post("/messages", payload)).data;