import { t } from "../trpc";
import { apiRouter } from "./api";
import { authRouter } from "./auth";
import { keyRouter } from "./key";
import { keySettingsRouter } from "./keySettings";
import { permissionRouter } from "./permission";
import { plainRouter } from "./plain";
import { vercelRouter } from "./vercel";
import { workspaceRouter } from "./workspace";
export const router = t.router({
  key: keyRouter,
  api: apiRouter,
  workspace: workspaceRouter,
  vercel: vercelRouter,
  plain: plainRouter,
  permission: permissionRouter,
  keySettings: keySettingsRouter,
  auth: authRouter,
});

// export type definition of API
export type Router = typeof router;
