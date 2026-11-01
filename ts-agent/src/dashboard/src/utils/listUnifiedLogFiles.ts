/** Read the static Pages manifest, falling back to the Vite development API. */
export const listUnifiedLogFiles = async (
  baseUrl: string,
  paths: { logsUnifiedBase: string; logsIndex: string },
  request: typeof fetch = fetch,
): Promise<string[]> => {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const endpoints = [
    `${base}${paths.logsUnifiedBase}/manifest.json`,
    `${base}${paths.logsIndex}?bucket=unified`,
  ];

  for (const url of endpoints) {
    try {
      const response = await request(url, { cache: "no-store" });
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) continue;
      return payload.filter(
        (entry): entry is string =>
          typeof entry === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(entry) &&
          !entry.includes("..") &&
          entry !== "manifest.json",
      );
    } catch {
      // A missing static manifest is expected in local development.
    }
  }

  return [];
};
