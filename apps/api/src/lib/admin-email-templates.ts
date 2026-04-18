import {
  ORGANIZER_CONTACTS,
  getTableById,
} from "@loppemarked/shared";
import type { Language } from "@loppemarked/shared";

export type AdminNotificationAction = "add" | "move" | "remove" | "waitlist_assign";

export interface NotificationPreviewInput {
  action: AdminNotificationAction;
  recipientName: string;
  recipientEmail: string;
  language: Language;
  boxId: number;
  oldBoxId?: number;
}

export interface NotificationPreview {
  subject: string;
  bodyHtml: string;
  recipientEmail: string;
  language: Language;
}

const translations = {
  da: {
    addSubject: "Bekræftelse af din loppebord-booking – UN17 Village Loppemarked",
    moveSubject: "Ændring af dit loppebord – UN17 Village Loppemarked",
    removeSubject: "Din loppebord-booking er fjernet – UN17 Village Loppemarked",

    greeting: (name: string) => `Kære ${name},`,
    addIntro: "Du har booket et loppebord til UN17 Village Loppemarked. Din booking er nu bekræftet.",
    moveIntro: "Din loppebord-booking til UN17 Village Loppemarked er blevet ændret.",
    moveDetail: (oldLabel: string, newLabel: string) =>
      `Dit loppebord er blevet flyttet fra ${oldLabel} til ${newLabel}.`,
    removeIntro: "Vi skriver for at informere dig om, at din loppebord-booking til UN17 Village Loppemarked er blevet fjernet.",
    removeDetail: (label: string) =>
      `Din booking for ${label} er ikke længere aktiv.`,

    tableDetailsTitle: "Dit loppebord",
    tableLabel: "Bord",
    sizeLabel: "Størrelse",

    contactTitle: "Kontakt",
    contactText: "Hvis du har spørgsmål, er du velkommen til at kontakte os:",
    closing: "Med venlig hilsen,",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    addSubject: "Confirmation of your flea-market table booking – UN17 Village Loppemarked",
    moveSubject: "Change to your flea-market table – UN17 Village Loppemarked",
    removeSubject: "Your flea-market table booking has been removed – UN17 Village Loppemarked",

    greeting: (name: string) => `Dear ${name},`,
    addIntro: "You have booked a table for UN17 Village Loppemarked. Your booking is now confirmed.",
    moveIntro: "Your flea-market table booking for UN17 Village Loppemarked has been updated.",
    moveDetail: (oldLabel: string, newLabel: string) =>
      `Your flea-market table has been moved from ${oldLabel} to ${newLabel}.`,
    removeIntro: "We are writing to let you know that your flea-market table booking for UN17 Village Loppemarked has been removed.",
    removeDetail: (label: string) =>
      `Your booking for ${label} is no longer active.`,

    tableDetailsTitle: "Your flea-market table",
    tableLabel: "Table",
    sizeLabel: "Size",

    contactTitle: "Contact",
    contactText: "If you have any questions, feel free to reach out to us:",
    closing: "Best regards,",
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

function buildTableDetailsHtml(
  t: (typeof translations)["da"] | (typeof translations)["en"],
  boxId: number,
): string {
  const table = getTableById(boxId);
  const tableNumber = table?.number ?? boxId;
  const size = table ? `${table.sizeMeters} m` : "\u2014";

  return `
      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px;">${escapeHtml(t.tableDetailsTitle)}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 40%;">${escapeHtml(t.tableLabel)}</td>
          <td style="padding: 8px 12px;">#${tableNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">${escapeHtml(t.sizeLabel)}</td>
          <td style="padding: 8px 12px;">${escapeHtml(size)}</td>
        </tr>
      </table>`;
}

function tableLabelFor(boxId: number | undefined, t: (typeof translations)["da"] | (typeof translations)["en"]): string {
  if (boxId == null) return `${t.tableLabel} #?`;
  const table = getTableById(boxId);
  const tableNumber = table?.number ?? boxId;
  return `${t.tableLabel} #${tableNumber}`;
}

function buildContactHtml(
  t: (typeof translations)["da"] | (typeof translations)["en"],
): string {
  const contactListHtml = ORGANIZER_CONTACTS.map(
    (c) =>
      `<li><a href="mailto:${escapeHtml(c.email)}" style="color: #2e7d32;">${escapeHtml(c.name)}</a></li>`,
  ).join("");

  return `
      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px;">${escapeHtml(t.contactTitle)}</h2>
      <p>${escapeHtml(t.contactText)}</p>
      <ul style="padding-left: 20px; line-height: 1.8;">
        ${contactListHtml}
      </ul>`;
}

function wrapEmailHtml(language: Language, subject: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <div style="background: #2e7d32; padding: 24px 32px;">
      <h1 style="margin: 0; color: #fff; font-size: 22px;">UN17 Village Loppemarked</h1>
    </div>

    <div style="padding: 32px;">
      ${contentHtml}
    </div>

    <div style="background: #f5f5f5; padding: 16px 32px; font-size: 12px; color: #888; text-align: center;">
      <p style="margin: 0;">UN17 Village Loppemarked &ndash; UN17 Hub</p>
    </div>
  </div>
</body>
</html>`;
}

function buildAddNotification(data: NotificationPreviewInput): NotificationPreview {
  const t = translations[data.language];
  const tableDetailsHtml = buildTableDetailsHtml(t, data.boxId);
  const contactHtml = buildContactHtml(t);

  const contentHtml = `
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.addIntro)}</p>
      ${tableDetailsHtml}
      ${contactHtml}
      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold;">${escapeHtml(t.teamSignature)}</p>`;

  return {
    subject: t.addSubject,
    bodyHtml: wrapEmailHtml(data.language, t.addSubject, contentHtml),
    recipientEmail: data.recipientEmail,
    language: data.language,
  };
}

function buildMoveNotification(data: NotificationPreviewInput): NotificationPreview {
  const t = translations[data.language];

  const oldLabel = tableLabelFor(data.oldBoxId, t);
  const newLabel = tableLabelFor(data.boxId, t);

  const tableDetailsHtml = buildTableDetailsHtml(t, data.boxId);
  const contactHtml = buildContactHtml(t);

  const contentHtml = `
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.moveIntro)}</p>
      <div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #0d47a1;">${escapeHtml(t.moveDetail(oldLabel, newLabel))}</p>
      </div>
      ${tableDetailsHtml}
      ${contactHtml}
      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold;">${escapeHtml(t.teamSignature)}</p>`;

  return {
    subject: t.moveSubject,
    bodyHtml: wrapEmailHtml(data.language, t.moveSubject, contentHtml),
    recipientEmail: data.recipientEmail,
    language: data.language,
  };
}

function buildRemoveNotification(data: NotificationPreviewInput): NotificationPreview {
  const t = translations[data.language];

  const label = tableLabelFor(data.boxId, t);

  const contactHtml = buildContactHtml(t);

  const contentHtml = `
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.removeIntro)}</p>
      <div style="background: #fce4ec; border-left: 4px solid #c62828; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #b71c1c;">${escapeHtml(t.removeDetail(label))}</p>
      </div>
      ${contactHtml}
      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold;">${escapeHtml(t.teamSignature)}</p>`;

  return {
    subject: t.removeSubject,
    bodyHtml: wrapEmailHtml(data.language, t.removeSubject, contentHtml),
    recipientEmail: data.recipientEmail,
    language: data.language,
  };
}

const bulkTemplateTranslations = {
  da: {
    greeting: "Kære beboer,",
    placeholder: "Skriv dit budskab her...",
    closing: "Med venlig hilsen,",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    greeting: "Dear resident,",
    placeholder: "Write your message here...",
    closing: "Best regards,",
    teamSignature: "The UN17 Village Loppemarked Team",
  },
} as const;

export function buildBulkEmailTemplate(language: Language): string {
  const t = bulkTemplateTranslations[language];

  return `<p style="margin-top: 0;">${escapeHtml(t.greeting)}</p>

<p>${escapeHtml(t.placeholder)}</p>

<p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
<p style="font-weight: bold;">${escapeHtml(t.teamSignature)}</p>`;
}

export { wrapEmailHtml };

export function buildAdminNotification(data: NotificationPreviewInput): NotificationPreview {
  switch (data.action) {
    case "add":
    case "waitlist_assign":
      return buildAddNotification(data);
    case "move":
      return buildMoveNotification(data);
    case "remove":
      return buildRemoveNotification(data);
  }
}
