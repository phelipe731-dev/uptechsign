import api, { setAccessToken } from "./api";
import type { TokenResponse, User } from "../types";

export async function login(
  email: string,
  password: string
): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/login", { email, password });
  setAccessToken(res.data.access_token);
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}

export async function refreshToken(): Promise<string> {
  const res = await api.post<TokenResponse>("/auth/refresh");
  setAccessToken(res.data.access_token);
  return res.data.access_token;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me");
  return res.data;
}

export async function updateMe(data: {
  email?: string;
  full_name?: string;
}): Promise<User> {
  const res = await api.put<User>("/auth/me", data);
  return res.data;
}

export async function updateMySignature(data: {
  default_mode: "drawn" | "typed";
  typed_name: string;
  signature_image_base64?: string | null;
  initials?: string | null;
}): Promise<User> {
  const res = await api.put<User>("/auth/me/signature", data);
  return res.data;
}

export async function changeMyPassword(data: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await api.put("/auth/me/password", data);
}
