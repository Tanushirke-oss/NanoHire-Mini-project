import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nanohire_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const register = async (payload) => (await api.post("/auth/register", payload)).data;
export const login = async (payload) => (await api.post("/auth/login", payload)).data;
export const getMe = async () => (await api.get("/auth/me")).data;

export const getUsers = async () => (await api.get("/users")).data;
export const getUser = async (userId) => (await api.get(`/users/${userId}`)).data;
export const getCurrentUser = async () => (await api.get("/users/me")).data;
export const updateUser = async (userId, payload) => (await api.put(`/users/${userId}`, payload)).data;
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
export const createPost = async ({ content, mediaFile }) => {
  const formData = new FormData();
  formData.append("content", content);
  if (mediaFile) {
    formData.append("media", mediaFile);
  }

  return (
    await api.post("/posts", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
  ).data;
};
export const togglePostLike = async (postId) => (await api.post(`/posts/${postId}/like`)).data;
export const commentOnPost = async (postId, payload) => (await api.post(`/posts/${postId}/comment`, payload)).data;
export const sharePost = async (postId) => (await api.post(`/posts/${postId}/share`)).data;

export const getGigs = async () => (await api.get("/gigs")).data;
export const getGig = async (gigId) => (await api.get(`/gigs/${gigId}`)).data;
export const createGig = async (payload) => (await api.post("/gigs", payload)).data;
export const setGigOnchain = async (gigId, payload) => (await api.post(`/gigs/${gigId}/onchain`, payload)).data;
export const applyGig = async (gigId, payload = {}) => {
  if (payload.resumeFile) {
    const formData = new FormData();
    if (payload.note) formData.append("note", payload.note);
    formData.append("resume", payload.resumeFile);
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
export const getMessages = async () => (await api.get("/messages")).data;
export const getConversation = async (gigId, otherUserId) => 
  (await api.get(`/messages/${gigId}/${otherUserId}`)).data;
export const sendMessage = async (payload) => 
  (await api.post("/messages", payload)).data;