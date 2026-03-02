/**
 * ダッシュボード設定の一元管理
 */

export const DASHBOARD_CONFIG = {
  api: {
    port: Number(import.meta.env.VITE_API_PORT ?? 8787),
    paths: {
      logsIndex: "logs/__index",
      logsUnifiedBase: "logs/unified",
      verificationData: "verification/standard_verification_data.json",
      verificationImg: "verification",
    },
  },
  poll: {
    intervalMs: 60_000,
  },
} as const;
