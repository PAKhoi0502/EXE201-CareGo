const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const AUTH_PATHS_WITHOUT_REFRESH = [
  "/auth/login",
  "/auth/signup",
  "/auth/verify-email",
  "/auth/resend-otp",
  "/auth/logout",
  "/auth/refresh-token",
  "/auth/forget-password",
  "/auth/reset-password",
];

let refreshPromise = null;

export const getToken = () => localStorage.getItem("carego_token");

export const setToken = (token) => {
  if (token) {
    localStorage.setItem("carego_token", token);
  } else {
    localStorage.removeItem("carego_token");
  }
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const createRequestError = (data, status, fallbackMessage = "Request failed") => {
  const error = new Error(data?.message || data?.error || fallbackMessage);
  error.status = status;
  error.code = data?.code;
  error.email = data?.email;
  error.data = data;
  return error;
};

const buildHeaders = (headers = {}, body, token = getToken()) => {
  const nextHeaders = new Headers(headers);

  if (!(body instanceof FormData) && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return Object.fromEntries(nextHeaders.entries());
};

const shouldAttemptRefresh = (path, status, data = {}) => {
  const isAuthFailure = status === 401 || (status === 403 && data?.message === "invalid token");
  if (!isAuthFailure || !getToken()) return false;
  return !AUTH_PATHS_WITHOUT_REFRESH.some((authPath) => path.startsWith(authPath));
};

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
      });
      const data = await parseResponse(response);

      if (!response.ok || !data.accessToken) {
        setToken(null);
        throw createRequestError(data, response.status, "Session expired");
      }

      setToken(data.accessToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const sendRequest = (path, options = {}, token = getToken()) =>
  fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: buildHeaders(options.headers, options.body, token),
  });

export const request = async (path, options = {}) => {
  let response = await sendRequest(path, options);
  let data = await parseResponse(response);

  if (!response.ok && shouldAttemptRefresh(path, response.status, data)) {
    const accessToken = await refreshAccessToken();
    response = await sendRequest(path, options, accessToken);
    data = await parseResponse(response);
  }

  if (!response.ok) {
    throw createRequestError(data, response.status);
  }

  return data;
};

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export const uploadImage = async ({ file, folder = "carego" }) => {
  const token = getToken();
  const formData = new FormData();
  formData.append("image", file);
  formData.append("folder", folder);

  const sendUploadRequest = (accessToken) =>
    fetch(`${API_BASE_URL}/upload/image`, {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });

  let response = await sendUploadRequest(token);
  let data = await parseResponse(response);

  if (!response.ok && shouldAttemptRefresh("/upload/image", response.status, data)) {
    const accessToken = await refreshAccessToken();
    response = await sendUploadRequest(accessToken);
    data = await parseResponse(response);
  }

  if (!response.ok) {
    throw createRequestError(data, response.status, "Upload failed");
  }

  return data;
};
