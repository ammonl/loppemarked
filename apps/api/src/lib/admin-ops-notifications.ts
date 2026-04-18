import { formatTableLabel } from "@loppemarked/shared";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types.js";
import { queueAndSendEmail } from "./email-service.js";
import { logger } from "./logger.js";

export type AdminOpsEvent =
  | { type: "user_registration"; userName: string; userEmail: string; boxId: number }
  | { type: "user_switch"; userName: string; userEmail: string; oldBoxId: number; newBoxId: number }
  | { type: "admin_box_reserve"; actingAdminId: string; boxId: number }
  | { type: "admin_box_release"; actingAdminId: string; boxId: number }
  | { type: "admin_registration_create"; actingAdminId: string; userName: string; boxId: number }
  | { type: "admin_registration_move"; actingAdminId: string; userName: string; oldBoxId: number; newBoxId: number }
  | { type: "admin_registration_remove"; actingAdminId: string; userName: string; boxId: number }
  | { type: "admin_waitlist_assign"; actingAdminId: string; userName: string; boxId: number };

function tableLabel(boxId: number): string {
  return formatTableLabel(boxId);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface AdminEventWithEmail {
  actingAdminEmail: string;
  event: AdminOpsEvent;
}

export function buildOpsNotificationEmail(eventWithEmail: AdminEventWithEmail | { event: AdminOpsEvent }): { subject: string; bodyHtml: string } {
  const { event } = eventWithEmail;
  const adminEmail = "actingAdminEmail" in eventWithEmail ? eventWithEmail.actingAdminEmail : "";
  let subject: string;
  let bodyText: string;

  switch (event.type) {
    case "user_registration":
      subject = `New booking: ${event.userName} → ${tableLabel(event.boxId)}`;
      bodyText = `<strong>${escapeHtml(event.userName)}</strong> (${escapeHtml(event.userEmail)}) booked <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
    case "user_switch":
      subject = `Table switch: ${event.userName} moved from ${tableLabel(event.oldBoxId)} to ${tableLabel(event.newBoxId)}`;
      bodyText = `<strong>${escapeHtml(event.userName)}</strong> (${escapeHtml(event.userEmail)}) switched from <strong>${escapeHtml(tableLabel(event.oldBoxId))}</strong> to <strong>${escapeHtml(tableLabel(event.newBoxId))}</strong>.`;
      break;
    case "admin_box_reserve":
      subject = `Table reserved: ${tableLabel(event.boxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> reserved <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
    case "admin_box_release":
      subject = `Table released: ${tableLabel(event.boxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> released <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
    case "admin_registration_create":
      subject = `Booking added: ${event.userName} → ${tableLabel(event.boxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> booked <strong>${escapeHtml(event.userName)}</strong> for <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
    case "admin_registration_move":
      subject = `Booking moved: ${event.userName} from ${tableLabel(event.oldBoxId)} to ${tableLabel(event.newBoxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> moved <strong>${escapeHtml(event.userName)}</strong> from <strong>${escapeHtml(tableLabel(event.oldBoxId))}</strong> to <strong>${escapeHtml(tableLabel(event.newBoxId))}</strong>.`;
      break;
    case "admin_registration_remove":
      subject = `Booking removed: ${event.userName} from ${tableLabel(event.boxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> removed <strong>${escapeHtml(event.userName)}</strong> from <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
    case "admin_waitlist_assign":
      subject = `Waitlist assigned: ${event.userName} → ${tableLabel(event.boxId)}`;
      bodyText = `Admin <strong>${escapeHtml(adminEmail)}</strong> assigned <strong>${escapeHtml(event.userName)}</strong> from the waitlist to <strong>${escapeHtml(tableLabel(event.boxId))}</strong>.`;
      break;
  }

  const bodyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#333;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:#2e7d32;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">UN17 Village Loppemarked — Admin Notification</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin-top:0;font-size:15px;">${bodyText}</p>
      <p style="color:#888;font-size:13px;margin-top:24px;">You received this email because you have admin notifications enabled. You can change your preferences in the admin dashboard under Settings.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, bodyHtml };
}

function isUserEvent(event: AdminOpsEvent): boolean {
  return event.type === "user_registration" || event.type === "user_switch";
}

/**
 * Send operational notification emails to opted-in admins.
 * Errors are caught and logged — they never fail the caller.
 */
export async function notifyAdmins(
  db: Kysely<Database> | Transaction<Database>,
  event: AdminOpsEvent,
): Promise<void> {
  try {
    const preferenceColumn = isUserEvent(event)
      ? "notify_user_registration" as const
      : "notify_admin_box_action" as const;

    const adminsWithPrefs = await db
      .selectFrom("admins")
      .leftJoin(
        "admin_notification_preferences",
        "admins.id",
        "admin_notification_preferences.admin_id",
      )
      .select([
        "admins.id",
        "admins.email",
        `admin_notification_preferences.${preferenceColumn} as pref`,
      ])
      .execute();

    // Look up the acting admin's email for the notification body
    let actingAdminEmail = "";
    if (!isUserEvent(event) && "actingAdminId" in event) {
      const acting = adminsWithPrefs.find((a) => a.id === event.actingAdminId);
      actingAdminEmail = acting?.email ?? "";
    }

    const { subject, bodyHtml } = buildOpsNotificationEmail(
      actingAdminEmail ? { actingAdminEmail, event } : { event },
    );

    const recipients = adminsWithPrefs.filter((admin) => {
      const optedIn = admin.pref ?? true;
      if (!optedIn) return false;
      if (!isUserEvent(event) && "actingAdminId" in event && event.actingAdminId === admin.id) {
        return false;
      }
      return true;
    });

    await Promise.allSettled(
      recipients.map((admin) =>
        queueAndSendEmail(db, {
          recipientEmail: admin.email,
          language: "en",
          subject,
          bodyHtml,
        }),
      ),
    );
  } catch (err) {
    logger.error("Failed to send admin ops notifications", err);
  }
}
