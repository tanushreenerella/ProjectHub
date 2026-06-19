const FALLBACK_API_URL = "https://projecthub-1-3a1i.onrender.com";

export const API_BASE_URL = (() => {
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  const isUnresolvedEnvExpression =
    raw.includes("import.meta.env") || raw.includes("{") || raw.includes("}");

  return (raw && !isUnresolvedEnvExpression ? raw : FALLBACK_API_URL).replace(/\/+$/, "");
})();

export const apiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const getAuthToken = () => localStorage.getItem("csh_token");

export const authHeaders = (token = getAuthToken()) =>
  token ? { Authorization: `Bearer ${token}` } : {};
