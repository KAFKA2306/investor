/**
 * フロントエンドからバックエンドAPIを可愛く叩くためのフックだよっ！📡💖
 */

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Fetchのラッパー、apiClientだよっ！⚡✨
 */
export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * データの守護者、useApiフック（擬似）だよっ！🌈✨
 */
export const useApi = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body: unknown) =>
    apiClient<T>(endpoint, { method: "POST", body }),
};
