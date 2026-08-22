/**
 * API client for the FocusForge backend.
 * All requests are authenticated via Cognito access token.
 */

import { getAccessToken } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL || "/api";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API ${method} ${path} failed: ${res.status}`);
  }

  return res.json();
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export interface ApiTask {
  taskId: string;
  title: string;
  description?: string;
  priority?: string;
  estimatedMinutes?: number;
  createdAt: string;
}

export async function listTasks(): Promise<ApiTask[]> {
  const data = await request<{ tasks: ApiTask[] }>("GET", "/tasks");
  return data.tasks;
}

export async function createTask(title: string): Promise<ApiTask> {
  return request<ApiTask>("POST", "/tasks", { title, priority: "raw" });
}

export async function updateTask(taskId: string, updates: Partial<Pick<ApiTask, "title" | "priority" | "estimatedMinutes">>): Promise<ApiTask> {
  return request<ApiTask>("PUT", `/tasks/${taskId}`, updates);
}

export async function deleteTask(taskId: string): Promise<void> {
  await request<unknown>("DELETE", `/tasks/${taskId}`);
}

// ─── Forge Master ───────────────────────────────────────────────────────────

export interface ForgePlan {
  estimates?: Array<{
    title: string;
    minutes: number;
    why: string;
  }>;
  tip?: string;
  _fallback?: boolean;
}

export async function invokeForgeMaster(): Promise<ForgePlan> {
  return request<ForgePlan>("POST", "/forge");
}
