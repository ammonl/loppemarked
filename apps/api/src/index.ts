import { GREENHOUSES } from "@loppemarked/shared";
import { createDatabase } from "./db/connection.js";
import { migrateToLatestInline } from "./db/migration-registry.js";
import { seed } from "./db/seed.js";
import { hashPassword } from "./lib/password.js";
import { deleteExpiredSessions } from "./lib/session.js";
import { requireAdmin } from "./middleware/auth.js";
import { Router } from "./router.js";
import type { RequestContext } from "./router.js";
import { handleCreateAdmin, handleDeleteAdmin, handleListAdmins } from "./routes/admin/admins.js";
import { handleListAuditEvents } from "./routes/admin/audit.js";
import { handleAdminBoxes, handleReserveBox, handleReleaseBox } from "./routes/admin/boxes.js";
import { handleChangePassword, handleLogin, handleLogout, handleMe } from "./routes/admin/auth.js";
import {
  handleAssignWaitlist,
  handleCreateRegistration,
  handleListRegistrations,
  handleMoveRegistration,
  handleNotificationPreview,
  handleRemoveRegistration,
} from "./routes/admin/registrations.js";
import {
  handleGetBulkEmailTemplate,
  handleBulkEmailPreview,
  handleGetRecipients,
  handleSendBulkEmail,
} from "./routes/admin/messaging.js";
import {
  handleGetOpeningTime,
  handleUpdateOpeningTime,
  handleGetNotificationPreferences,
  handleUpdateNotificationPreferences,
} from "./routes/admin/settings.js";
import {
  handleFillBoxes,
  handleClearRegistrations,
} from "./routes/admin/staging.js";
import { handleListWaitlist, handleRemoveWaitlist } from "./routes/admin/waitlist.js";
import { handleHealth } from "./routes/health.js";
import {
  handleCancellationConfirm,
  handleCancellationInfo,
  handleJoinWaitlist,
  handlePublicBoxes,
  handlePublicGreenhouses,
  handlePublicRegister,
  handlePublicStatus,
  handleValidateAddress,
  handleValidateRegistration,
  handleWaitlistPosition,
} from "./routes/public.js";

export function getGreenhouses(): readonly string[] {
  return GREENHOUSES;
}

export function createRouter(): Router {
  const router = new Router();

  router.get("/health", handleHealth);

  router.get("/public/status", handlePublicStatus);
  router.get("/public/greenhouses", handlePublicGreenhouses);
  router.get("/public/boxes", handlePublicBoxes);
  router.post("/public/validate-address", handleValidateAddress);
  router.post("/public/validate-registration", handleValidateRegistration);
  router.post("/public/register", handlePublicRegister);
  router.post("/public/waitlist", handleJoinWaitlist);
  router.get("/public/waitlist/position/:apartmentKey", handleWaitlistPosition);
  router.get("/public/cancel/:token", handleCancellationInfo);
  router.post("/public/cancel/:token", handleCancellationConfirm);

  router.post("/admin/auth/login", handleLogin);
  router.get("/admin/auth/me", requireAdmin(handleMe));
  router.post("/admin/auth/logout", requireAdmin(handleLogout));
  router.post("/admin/auth/change-password", requireAdmin(handleChangePassword));

  router.get("/admin/admins", requireAdmin(handleListAdmins));
  router.post("/admin/admins", requireAdmin(handleCreateAdmin));
  router.delete("/admin/admins/:id", requireAdmin(handleDeleteAdmin));

  router.get("/admin/boxes", requireAdmin(handleAdminBoxes));
  router.post("/admin/boxes/reserve", requireAdmin(handleReserveBox));
  router.post("/admin/boxes/release", requireAdmin(handleReleaseBox));
  router.get("/admin/registrations", requireAdmin(handleListRegistrations));
  router.post("/admin/registrations", requireAdmin(handleCreateRegistration));
  router.post("/admin/registrations/move", requireAdmin(handleMoveRegistration));
  router.post("/admin/registrations/remove", requireAdmin(handleRemoveRegistration));
  router.get("/admin/waitlist", requireAdmin(handleListWaitlist));
  router.post("/admin/waitlist/assign", requireAdmin(handleAssignWaitlist));
  router.delete("/admin/waitlist/:id", requireAdmin(handleRemoveWaitlist));
  router.post("/admin/notifications/preview", requireAdmin(handleNotificationPreview));
  router.post("/admin/messaging/template", requireAdmin(handleGetBulkEmailTemplate));
  router.post("/admin/messaging/preview", requireAdmin(handleBulkEmailPreview));
  router.post("/admin/messaging/recipients", requireAdmin(handleGetRecipients));
  router.post("/admin/messaging/send", requireAdmin(handleSendBulkEmail));
  router.post("/admin/audit-events", requireAdmin(handleListAuditEvents));

  router.get("/admin/settings/opening-time", requireAdmin(handleGetOpeningTime));
  router.patch("/admin/settings/opening-time", requireAdmin(handleUpdateOpeningTime));
  router.get("/admin/settings/notification-preferences", requireAdmin(handleGetNotificationPreferences));
  router.patch("/admin/settings/notification-preferences", requireAdmin(handleUpdateNotificationPreferences));

  if (process.env["ENVIRONMENT"] === "staging") {
    router.post("/admin/staging/fill-boxes", requireAdmin(handleFillBoxes));
    router.post("/admin/staging/clear-registrations", requireAdmin(handleClearRegistrations));
  }

  return router;
}

export interface LambdaHttpEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}

export interface ScheduledEvent {
  source: string;
  "detail-type": string;
  detail: Record<string, unknown>;
}

export interface MigrateEvent {
  action: "migrate";
}

export type LambdaEvent = LambdaHttpEvent | ScheduledEvent | MigrateEvent;

export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function isMigrateEvent(event: LambdaEvent): event is MigrateEvent {
  return "action" in event && (event as MigrateEvent).action === "migrate";
}

function isScheduledEvent(event: LambdaEvent): event is ScheduledEvent {
  return "detail-type" in event && (event as ScheduledEvent)["detail-type"] === "Scheduled Event";
}

let router: Router | undefined;
let db: ReturnType<typeof createDatabase> | undefined;

async function resolveDbPassword(): Promise<string> {
  if (process.env["DB_PASSWORD"]) {
    return process.env["DB_PASSWORD"];
  }
  const secretArn = process.env["DB_SECRET_ARN"];
  if (!secretArn) {
    return "";
  }
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );
  const client = new SecretsManagerClient({});
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const secret = JSON.parse(result.SecretString ?? "{}") as Record<string, string>;
  return secret["password"] ?? "";
}

async function ensureDb(): Promise<ReturnType<typeof createDatabase>> {
  if (!db) {
    const password = await resolveDbPassword();
    db = createDatabase({
      host: process.env["DB_HOST"] ?? "localhost",
      port: Number(process.env["DB_PORT"] ?? "5433"),
      database: process.env["DB_NAME"] ?? "loppemarked",
      user: process.env["DB_USER"] ?? "loppemarked",
      password,
      ssl: process.env["DB_SSL"] === "true",
    });
  }
  return db;
}

export async function handler(event: LambdaEvent): Promise<LambdaResponse> {
  if (isMigrateEvent(event)) {
    try {
      const database = await ensureDb();
      const { executedMigrations } = await migrateToLatestInline(database);
      const seedPassword = process.env["SEED_ADMIN_PASSWORD"] ?? "changeme123";
      await seed(database, hashPassword, seedPassword);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "migrate", executedMigrations, seeded: true }),
      };
    } catch (err) {
      console.error("Migration failed:", err);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "migrate", error: String(err) }),
      };
    }
  }

  if (isScheduledEvent(event)) {
    try {
      const database = await ensureDb();
      const deleted = await deleteExpiredSessions(database);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "session-cleanup", deletedSessions: deleted }),
      };
    } catch (err) {
      console.error("Session cleanup failed:", err);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "session-cleanup", error: "Cleanup failed" }),
      };
    }
  }

  if (!router) {
    router = createRouter();
  }
  const database = await ensureDb();

  let body: unknown = undefined;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }
  }

  const normalizedHeaders: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  const ctx: RequestContext = {
    db: database,
    method: event.httpMethod,
    path: event.path,
    body,
    headers: normalizedHeaders,
    params: {},
  };

  const response = await router.handle(ctx);

  return {
    statusCode: response.statusCode,
    headers: {
      "Content-Type": "application/json",
      ...response.headers,
    },
    body: JSON.stringify(response.body),
  };
}
