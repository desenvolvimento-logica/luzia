import "server-only";
import { parseAllowedOrigins } from "./security/origins";

export interface HubServerConfig {
  hubOrigin: string | null;
  appOrigins: string[];
  allowLocalApps: boolean;
  iconBucket: string;
}

export function serverConfig(): HubServerConfig {
  const allowLocalApps = process.env.NODE_ENV !== "production" && process.env.LUZIA_ALLOW_LOCAL_APPS === "true";
  let hubOrigin: string | null = null;
  if (process.env.LUZIA_HUB_ORIGIN) {
    try {
      hubOrigin = new URL(process.env.LUZIA_HUB_ORIGIN).origin;
    } catch {
      hubOrigin = null;
    }
  }
  return {
    hubOrigin,
    appOrigins: parseAllowedOrigins(process.env.LUZIA_APP_ALLOWED_ORIGINS, { allowLocal: allowLocalApps }),
    allowLocalApps,
    iconBucket: process.env.LUZIA_ICON_BUCKET || "app-icons",
  };
}
