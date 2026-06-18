import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f5d1386a`;

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("access_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { error: raw || "API request failed" };
  }

  if (!response.ok) {
    console.error(`API error on ${endpoint}:`, data);
    throw new Error(data?.error || data?.message || "API request failed");
  }

  return data;
}

export function setAccessToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function removeAccessToken() {
  localStorage.removeItem("access_token");
}

export function setUserProfile(profile: any) {
  localStorage.setItem("user_profile", JSON.stringify(profile));
}

export function getUserProfile() {
  const profile = localStorage.getItem("user_profile");
  return profile ? JSON.parse(profile) : null;
}

export function removeUserProfile() {
  localStorage.removeItem("user_profile");
}