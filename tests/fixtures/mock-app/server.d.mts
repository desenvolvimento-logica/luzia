import type { Server } from "node:http";

export function mockAppHtml(options: { hubOrigin: string; mode?: "app" | "evil" }): string;
export function startMockApp(options: { port: number; hubOrigin: string; mode?: "app" | "evil" }): Promise<Server>;
