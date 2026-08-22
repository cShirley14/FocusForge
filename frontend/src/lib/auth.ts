/**
 * Lightweight Cognito auth — USER_PASSWORD_AUTH flow via the public API.
 * No SDK dependency; uses fetch against the Cognito endpoint directly.
 */

const REGION = import.meta.env.VITE_AWS_REGION || "us-east-1";
const USER_POOL_CLIENT_ID = import.meta.env.VITE_USER_POOL_CLIENT_ID || "";
const COGNITO_URL = `https://cognito-idp.${REGION}.amazonaws.com/`;

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

const STORAGE_KEY = "focusforge_auth";

function stored(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(tokens: AuthTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  const t = stored();
  return t !== null && t.expiresAt > Date.now();
}

/**
 * Get a valid access token, refreshing if expired.
 */
export async function getAccessToken(): Promise<string> {
  const t = stored();
  if (!t) throw new Error("Not authenticated");

  // 60s buffer before expiry
  if (t.expiresAt - Date.now() > 60_000) {
    return t.accessToken;
  }

  // Refresh
  const res = await cognitoRequest("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: t.refreshToken },
  });

  if (!res.AuthenticationResult) throw new Error("Refresh failed");

  const refreshed: AuthTokens = {
    idToken: res.AuthenticationResult.IdToken,
    accessToken: res.AuthenticationResult.AccessToken,
    refreshToken: t.refreshToken, // refresh token doesn't rotate
    expiresAt: Date.now() + res.AuthenticationResult.ExpiresIn * 1000,
  };
  persist(refreshed);
  return refreshed.accessToken;
}

/**
 * Sign in with email + password.
 */
export async function signIn(email: string, password: string): Promise<void> {
  const res = await cognitoRequest("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

  if (res.ChallengeName) {
    throw new Error(`Auth challenge not supported: ${res.ChallengeName}`);
  }

  if (!res.AuthenticationResult) {
    throw new Error("Authentication failed");
  }

  const tokens: AuthTokens = {
    idToken: res.AuthenticationResult.IdToken,
    accessToken: res.AuthenticationResult.AccessToken,
    refreshToken: res.AuthenticationResult.RefreshToken,
    expiresAt: Date.now() + res.AuthenticationResult.ExpiresIn * 1000,
  };
  persist(tokens);
}

export function signOut() {
  clearAuth();
}

// ─── Internal ───────────────────────────────────────────────────────────────

async function cognitoRequest(action: string, payload: unknown): Promise<any> {
  const res = await fetch(COGNITO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.__type || `Cognito ${action} failed`);
  }

  return res.json();
}
