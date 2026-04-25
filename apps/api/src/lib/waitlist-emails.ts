import type { Kysely, Transaction } from "kysely";
import type { Language } from "@loppemarked/shared";
import type { Database } from "../db/types.js";
import { logAuditEvent } from "./audit.js";
import { wrapEmailHtml } from "./admin-email-templates.js";
import { queueAndSendEmail } from "./email-service.js";
import { logger } from "./logger.js";

const BRAND = {
  greenDark: "#6F8A6F",
  greenSoft: "#E8EFE8",
  salmon: "#C6705D",
  salmonDark: "#A85544",
  salmonSoft: "#FBEEEA",
  ink: "#5B4636",
} as const;

interface WaitlistPositionEmailInput {
  recipientName: string;
  recipientEmail: string;
  language: Language;
  newPosition: number;
}

interface WaitlistPositionEmail {
  subject: string;
  bodyHtml: string;
}

interface WaitlistJoinConfirmationEmailInput {
  recipientName: string;
  recipientEmail: string;
  language: Language;
  position: number;
}

interface WaitlistJoinConfirmationEmail {
  subject: string;
  bodyHtml: string;
}

const translations = {
  da: {
    subject: "Din ventelisteposition er forbedret – UN17 Village Loppemarked",
    greeting: (name: string) => `Kære ${name},`,
    intro:
      "Vi skriver for at fortælle dig, at din position på ventelisten til UN17 Village Loppemarked er rykket frem.",
    positionLabel: "Din nye position",
    positionDetail: (position: number) =>
      position === 1
        ? "Du er nu nummer 1 på ventelisten — du står først i køen."
        : `Du er nu nummer ${position} på ventelisten.`,
    closing:
      "Vi skriver igen, hvis et bord bliver tildelt dig. Du behøver ikke at gøre noget.",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    subject: "Your waitlist position has improved – UN17 Village Loppemarked",
    greeting: (name: string) => `Dear ${name},`,
    intro:
      "We're writing to let you know that your position on the UN17 Village Loppemarked waitlist has moved up.",
    positionLabel: "Your new position",
    positionDetail: (position: number) =>
      position === 1
        ? "You are now number 1 on the waitlist — you are first in line."
        : `You are now number ${position} on the waitlist.`,
    closing:
      "We will be in touch again if a table is assigned to you. No action is required.",
    teamSignature: "The UN17 Village Loppemarked Team",
  },
} as const;

const joinConfirmationTranslations = {
  da: {
    subject: "Du er på ventelisten – UN17 Village Loppemarked",
    greeting: (name: string) => `Kære ${name},`,
    intro:
      "Tak for din tilmelding til ventelisten for UN17 Village Loppemarked i Fælledhuset. Alle borde er aktuelt booket, men du står nu på ventelisten.",
    statusNote:
      "Bemærk: Du har endnu ikke et booket bord. Vi giver dig besked, hvis et bord bliver ledigt og tildelt dig.",
    positionLabel: "Din plads på ventelisten",
    positionDetail: (position: number) =>
      position === 1
        ? "Du er nummer 1 på ventelisten — du står først i køen."
        : `Du er nummer ${position} på ventelisten.`,
    nextSteps:
      "Du behøver ikke at gøre noget lige nu. Hvis et bord bliver ledigt og tilbudt dig, sender vi en ny e-mail med detaljerne.",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    subject: "You're on the waitlist – UN17 Village Loppemarked",
    greeting: (name: string) => `Dear ${name},`,
    intro:
      "Thank you for signing up for the UN17 Village Loppemarked waitlist at Fælledhuset. All tables are currently booked, but you are now on the waitlist.",
    statusNote:
      "Please note: you do not yet have a booked table. We will let you know if a table opens up and is assigned to you.",
    positionLabel: "Your waitlist position",
    positionDetail: (position: number) =>
      position === 1
        ? "You are number 1 on the waitlist — you are first in line."
        : `You are number ${position} on the waitlist.`,
    nextSteps:
      "No action is needed right now. If a table becomes available and is offered to you, we will send a follow-up email with the details.",
    teamSignature: "The UN17 Village Loppemarked Team",
  },
} as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildWaitlistPositionUpdateEmail(
  input: WaitlistPositionEmailInput,
): WaitlistPositionEmail {
  const t = translations[input.language];
  const positionText = t.positionDetail(input.newPosition);

  const contentHtml = `
      <p style="margin-top: 0;">${escapeHtml(t.greeting(input.recipientName))}</p>
      <p>${escapeHtml(t.intro)}</p>
      <div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0 0 4px; font-weight: 600; color: ${BRAND.ink};">${escapeHtml(t.positionLabel)}</p>
        <p style="margin: 0; color: ${BRAND.salmonDark}; font-size: 18px; font-weight: bold;">#${input.newPosition}</p>
        <p style="margin: 6px 0 0; color: ${BRAND.ink}; font-size: 14px;">${escapeHtml(positionText)}</p>
      </div>
      <p>${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;

  return {
    subject: t.subject,
    bodyHtml: wrapEmailHtml(input.language, t.subject, contentHtml),
  };
}

export function buildWaitlistJoinConfirmationEmail(
  input: WaitlistJoinConfirmationEmailInput,
): WaitlistJoinConfirmationEmail {
  const t = joinConfirmationTranslations[input.language];
  const positionText = t.positionDetail(input.position);

  const contentHtml = `
      <p style="margin-top: 0;">${escapeHtml(t.greeting(input.recipientName))}</p>
      <p>${escapeHtml(t.intro)}</p>
      <div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark};">${escapeHtml(t.statusNote)}</p>
      </div>
      <div style="background: ${BRAND.greenSoft}; border-left: 4px solid ${BRAND.greenDark}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0 0 4px; font-weight: 600; color: ${BRAND.ink};">${escapeHtml(t.positionLabel)}</p>
        <p style="margin: 0; color: ${BRAND.greenDark}; font-size: 18px; font-weight: bold;">#${input.position}</p>
        <p style="margin: 6px 0 0; color: ${BRAND.ink}; font-size: 14px;">${escapeHtml(positionText)}</p>
      </div>
      <p>${escapeHtml(t.nextSteps)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;

  return {
    subject: t.subject,
    bodyHtml: wrapEmailHtml(input.language, t.subject, contentHtml),
  };
}

interface DownstreamNotifyResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Email all waitlist entries that were below `removedEntryCreatedAt` to inform
 * them of their new position. Best-effort: per-recipient failures are logged
 * and counted, but never thrown.
 *
 * Must be called AFTER the removed/assigned entry's status has been updated
 * (so it is no longer counted as "waiting").
 */
export async function notifyDownstreamWaitlist(
  db: Kysely<Database> | Transaction<Database>,
  adminId: string,
  removedEntryCreatedAt: Date,
  context: { triggerAction: "waitlist_remove" | "waitlist_assign"; entityId: string },
): Promise<DownstreamNotifyResult> {
  const result: DownstreamNotifyResult = { attempted: 0, succeeded: 0, failed: 0 };

  let downstream: Array<{
    id: string;
    name: string;
    email: string;
    language: string;
  }>;
  let aboveCount: number;

  // The helper runs OUTSIDE the assign/remove transaction, so positions are
  // best-effort: a concurrent admin operation could shift the queue between
  // the count query and the email send. The `>=` lower bound on downstream
  // entries handles peers that shared the removed entry's exact `created_at`
  // (the removed/assigned entry itself is excluded by `status = "waiting"`),
  // and the `id` secondary ordering keeps positions deterministic for ties.
  try {
    downstream = await db
      .selectFrom("waitlist_entries")
      .select(["id", "name", "email", "language"])
      .where("status", "=", "waiting")
      .where("created_at", ">=", removedEntryCreatedAt)
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute();

    if (downstream.length === 0) {
      return result;
    }

    const above = await db
      .selectFrom("waitlist_entries")
      .select(db.fn.countAll<number>().as("count"))
      .where("status", "=", "waiting")
      .where("created_at", "<", removedEntryCreatedAt)
      .executeTakeFirstOrThrow();
    aboveCount = Number(above.count);
  } catch (err) {
    logger.error("Failed to load downstream waitlist entries", err);
    return result;
  }

  for (let i = 0; i < downstream.length; i++) {
    const entry = downstream[i];
    const newPosition = aboveCount + i + 1;
    const language: Language = entry.language === "en" ? "en" : "da";

    result.attempted++;

    try {
      const email = buildWaitlistPositionUpdateEmail({
        recipientName: entry.name,
        recipientEmail: entry.email,
        language,
        newPosition,
      });

      const emailId = await queueAndSendEmail(db, {
        recipientEmail: entry.email,
        language,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
      });

      if (emailId) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    } catch (err) {
      logger.error("Failed to send waitlist position update email", err);
      result.failed++;
    }
  }

  try {
    await logAuditEvent(db, {
      actor_type: "admin",
      actor_id: adminId,
      action: "waitlist_downstream_notified",
      entity_type: "waitlist_entry",
      entity_id: context.entityId,
      after: {
        trigger: context.triggerAction,
        attempted: result.attempted,
        succeeded: result.succeeded,
        failed: result.failed,
      },
    });
  } catch (err) {
    logger.error("Failed to log downstream notification audit event", err);
  }

  return result;
}
