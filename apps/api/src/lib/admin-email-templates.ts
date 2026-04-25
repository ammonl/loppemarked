import {
  EVENT_CONTACT,
  getTableById,
} from "@loppemarked/shared";
import type { Language } from "@loppemarked/shared";

export type AdminNotificationAction = "add" | "move" | "remove" | "waitlist_assign";

const BRAND = {
  green: "#8DA88D",
  greenDark: "#6F8A6F",
  greenSoft: "#E8EFE8",
  salmon: "#C6705D",
  salmonDark: "#A85544",
  salmonSoft: "#FBEEEA",
  cream: "#FDFBF7",
  pageBg: "#F5F1EA",
  ink: "#5B4636",
} as const;

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
    addSubject: "Confirmation of your table booking – UN17 Village Loppemarked",
    moveSubject: "Change to your table – UN17 Village Loppemarked",
    removeSubject: "Your table booking has been removed – UN17 Village Loppemarked",

    greeting: (name: string) => `Dear ${name},`,
    addIntro: "You have booked a table for UN17 Village Loppemarked. Your booking is now confirmed.",
    moveIntro: "Your table booking for UN17 Village Loppemarked has been updated.",
    moveDetail: (oldLabel: string, newLabel: string) =>
      `Your table has been moved from ${oldLabel} to ${newLabel}.`,
    removeIntro: "We are writing to let you know that your table booking for UN17 Village Loppemarked has been removed.",
    removeDetail: (label: string) =>
      `Your booking for ${label} is no longer active.`,

    tableDetailsTitle: "Your table",
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
      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px;">${escapeHtml(t.tableDetailsTitle)}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; width: 40%; color: ${BRAND.ink};">${escapeHtml(t.tableLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.salmonDark}; font-weight: bold; font-size: 18px;">#${tableNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; color: ${BRAND.ink};">${escapeHtml(t.sizeLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.ink};">${escapeHtml(size)}</td>
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
  return `
      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px;">${escapeHtml(t.contactTitle)}</h2>
      <p>${escapeHtml(t.contactText)}</p>
      <p style="margin: 8px 0 0;"><a href="mailto:${escapeHtml(EVENT_CONTACT.email)}" style="color: ${BRAND.salmonDark}; font-weight: 600; text-decoration: none;">${escapeHtml(EVENT_CONTACT.name)}</a></p>`;
}

function wrapEmailHtml(language: Language, subject: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${BRAND.pageBg}; color: ${BRAND.ink};">
  <div style="max-width: 600px; margin: 0 auto; background: ${BRAND.cream};">
    <div style="background: ${BRAND.green}; padding: 24px 32px; border-bottom: 4px solid ${BRAND.salmon};">
      <h1 style="margin: 0; color: ${BRAND.cream}; font-size: 22px; letter-spacing: 0.02em;">UN17 Village Loppemarked</h1>
    </div>

    <div style="padding: 32px;">
      ${contentHtml}
    </div>

    <div style="background: ${BRAND.salmon}; padding: 16px 32px; font-size: 12px; color: ${BRAND.cream}; text-align: center;">
      <p style="margin: 0;">UN17 Village Loppemarked &middot; Fælledhuset</p>
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
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;

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
      <div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark};">${escapeHtml(t.moveDetail(oldLabel, newLabel))}</p>
      </div>
      ${tableDetailsHtml}
      ${contactHtml}
      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;

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
      <div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark};">${escapeHtml(t.removeDetail(label))}</p>
      </div>
      ${contactHtml}
      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;

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
<p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>`;
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
