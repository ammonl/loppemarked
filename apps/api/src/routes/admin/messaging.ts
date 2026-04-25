import type { Language } from "@loppemarked/shared";
import { logAuditEvent } from "../../lib/audit.js";
import { buildBulkEmailTemplate, wrapEmailHtml } from "../../lib/admin-email-templates.js";
import { queueAndSendEmail } from "../../lib/email-service.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { RequestContext, RouteResponse } from "../../router.js";

const VALID_AUDIENCES = new Set<string>(["all"]);

interface Recipient {
  email: string;
  name: string;
  language: string;
}

async function queryRecipients(ctx: RequestContext): Promise<Recipient[]> {
  const query = ctx.db
    .selectFrom("registrations")
    .innerJoin("tables", "tables.id", "registrations.table_id")
    .select([
      "registrations.email",
      "registrations.name",
      "registrations.language",
    ])
    .where("registrations.status", "=", "active");

  const rows = await query.execute();

  const seen = new Set<string>();
  const unique: Recipient[] = [];
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ email: row.email, name: row.name, language: row.language });
    }
  }

  return unique;
}

interface RecipientsBody {
  audience?: string;
}

export async function handleGetRecipients(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as RecipientsBody;
  const { audience } = body;

  if (!audience || !VALID_AUDIENCES.has(audience)) {
    throw badRequest("audience must be: all");
  }

  const recipients = await queryRecipients(ctx);

  return {
    statusCode: 200,
    body: {
      audience,
      count: recipients.length,
      recipients: recipients.map((r) => ({
        email: r.email,
        name: r.name,
        language: r.language,
      })),
    },
  };
}

const VALID_LANGUAGES = new Set<string>(["da", "en"]);

interface TemplateBody {
  language?: string;
}

export async function handleGetBulkEmailTemplate(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as TemplateBody;
  const language: Language = VALID_LANGUAGES.has(body.language ?? "") ? (body.language as Language) : "da";

  const defaultBody = buildBulkEmailTemplate(language);

  return {
    statusCode: 200,
    body: {
      language,
      defaultBody,
    },
  };
}

interface PreviewBody {
  bodyHtml?: string;
  subject?: string;
  language?: string;
}

export async function handleBulkEmailPreview(ctx: RequestContext): Promise<RouteResponse> {
  if (!ctx.adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as PreviewBody;
  const { bodyHtml, subject } = body;
  const language: Language = VALID_LANGUAGES.has(body.language ?? "") ? (body.language as Language) : "da";

  if (!bodyHtml) {
    throw badRequest("bodyHtml is required");
  }

  const previewHtml = wrapEmailHtml(language, subject ?? "", bodyHtml);

  return {
    statusCode: 200,
    body: {
      previewHtml,
    },
  };
}

interface SendBulkEmailBody {
  audience?: string;
  subject?: string;
  bodyHtml?: string;
  bilingual?: boolean;
  subjectDa?: string;
  bodyHtmlDa?: string;
  subjectEn?: string;
  bodyHtmlEn?: string;
}

function resolveEmailContent(
  body: SendBulkEmailBody,
  recipientLanguage: "da" | "en",
): { subject: string; bodyHtml: string } {
  if (body.bilingual) {
    return recipientLanguage === "en"
      ? { subject: body.subjectEn!, bodyHtml: body.bodyHtmlEn! }
      : { subject: body.subjectDa!, bodyHtml: body.bodyHtmlDa! };
  }
  return { subject: body.subject!, bodyHtml: body.bodyHtml! };
}

export async function handleSendBulkEmail(ctx: RequestContext): Promise<RouteResponse> {
  const adminId = ctx.adminId;
  if (!adminId) {
    throw unauthorized();
  }

  const body = (ctx.body ?? {}) as SendBulkEmailBody;
  const { audience } = body;

  if (!audience || !VALID_AUDIENCES.has(audience)) {
    throw badRequest("audience must be: all");
  }

  if (body.bilingual) {
    if (!body.subjectDa || body.subjectDa.trim().length === 0) {
      throw badRequest("subjectDa is required in bilingual mode");
    }
    if (!body.bodyHtmlDa || body.bodyHtmlDa.trim().length === 0) {
      throw badRequest("bodyHtmlDa is required in bilingual mode");
    }
    if (!body.subjectEn || body.subjectEn.trim().length === 0) {
      throw badRequest("subjectEn is required in bilingual mode");
    }
    if (!body.bodyHtmlEn || body.bodyHtmlEn.trim().length === 0) {
      throw badRequest("bodyHtmlEn is required in bilingual mode");
    }
  } else {
    if (!body.subject || body.subject.trim().length === 0) {
      throw badRequest("subject is required");
    }
    if (!body.bodyHtml || body.bodyHtml.trim().length === 0) {
      throw badRequest("bodyHtml is required");
    }
  }

  const recipients = await queryRecipients(ctx);

  if (recipients.length === 0) {
    throw badRequest("No recipients found for the selected audience");
  }

  let queuedCount = 0;
  let queueFailedCount = 0;

  for (const recipient of recipients) {
    const lang: Language = VALID_LANGUAGES.has(recipient.language)
      ? (recipient.language as Language)
      : "da";
    const content = resolveEmailContent(body, lang);
    const wrappedHtml = wrapEmailHtml(lang, content.subject, content.bodyHtml);

    const emailId = await queueAndSendEmail(ctx.db, {
      recipientEmail: recipient.email,
      language: lang,
      subject: content.subject,
      bodyHtml: wrappedHtml,
    });

    if (emailId) {
      queuedCount++;
    } else {
      queueFailedCount++;
    }
  }

  const auditSubject = body.bilingual
    ? `[DA] ${body.subjectDa} / [EN] ${body.subjectEn}`
    : body.subject;

  await logAuditEvent(ctx.db, {
    actor_type: "admin",
    actor_id: adminId,
    action: "bulk_email_sent",
    entity_type: "messaging",
    entity_id: `bulk-${Date.now()}`,
    after: {
      audience,
      bilingual: body.bilingual ?? false,
      recipient_count: recipients.length,
      queued_count: queuedCount,
      queue_failed_count: queueFailedCount,
      subject: auditSubject,
    },
  });

  logger.info(`Bulk email sent: audience=${audience}, bilingual=${body.bilingual ?? false}, queued=${queuedCount}, queue_failed=${queueFailedCount}`);

  return {
    statusCode: 200,
    body: {
      audience,
      recipientCount: recipients.length,
      queuedCount,
      queueFailedCount,
    },
  };
}
