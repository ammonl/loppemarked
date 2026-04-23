import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  EVENT_CONTACT,
  getTableById,
} from "@loppemarked/shared";
import type { Language } from "@loppemarked/shared";

export interface ConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  language: Language;
  boxId: number;
  switchedFromBoxId?: number;
}

interface EmailContent {
  subject: string;
  bodyHtml: string;
  from: string;
  replyTo: string;
}

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
  mutedInk: "#8A7560",
} as const;

interface TableSummary {
  number: string;
  size: string;
}

function describeTable(id: number, t: (typeof translations)["da" | "en"]): TableSummary {
  const table = getTableById(id);
  if (!table) {
    return { number: `#${id}`, size: "—" };
  }
  return {
    number: `#${table.number}`,
    size: t.tableSizeValue(table.sizeMeters),
  };
}

const translations = {
  da: {
    subject: "Bekræftelse af din bordbooking – UN17 Village Loppemarked",
    greeting: (name: string) => `Kære ${name},`,
    confirmationIntro:
      "Tak for din tilmelding til UN17 Village Loppemarked i Fælledhuset! Din bordbooking er nu bekræftet.",
    switchNote: (oldTableNumber: string) =>
      `Bemærk: Din tidligere reservation af bord ${oldTableNumber} er blevet frigivet, og din booking er flyttet til det bord, der er vist nedenfor.`,
    tableDetailsTitle: "Dit bord",
    tableNumberLabel: "Bordnummer",
    tableSizeLabel: "Størrelse",
    tableLocationLabel: "Placering",
    tableLocationValue: "Fælledhuset",
    tableSizeValue: (meters: number) => `${meters} meter`,
    guidelinesTitle: "Praktisk information",
    guidelines: [
      "Mød op i god tid, så du er klar ved dit bord, inden markedet åbner.",
      "Medbring selv alt, hvad du skal bruge til prismærkning, opstilling og salg (fx prisskilte, poser, byttepenge og en dug eller klud).",
      "Har du særlige behov, fx adgang til strøm, så kontakt arrangørerne i god tid, så vi kan planlægge efter det.",
      "Bliv ved dit bord under hele markedet, så kunderne altid kan spørge og handle.",
      "Tag alle usolgte varer og eget affald med hjem, og efterlad dit bord rent og ryddet.",
      "Vær hjælpsom og venlig over for dine nabosælgere og gæsterne – det er det, der gør loppemarkedet hyggeligt.",
    ],
    contactTitle: "Kontakt",
    contactText: "Har du spørgsmål, er du velkommen til at skrive til arrangøren:",
    closing: "Vi glæder os til at se dig i Fælledhuset!",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    subject: "Confirmation of your table booking – UN17 Village Loppemarked",
    greeting: (name: string) => `Dear ${name},`,
    confirmationIntro:
      "Thank you for signing up for UN17 Village Loppemarked at Fælledhuset! Your table booking is now confirmed.",
    switchNote: (oldTableNumber: string) =>
      `Note: Your previous booking for table ${oldTableNumber} has been released, and your reservation has been moved to the table shown below.`,
    tableDetailsTitle: "Your table",
    tableNumberLabel: "Table number",
    tableSizeLabel: "Size",
    tableLocationLabel: "Location",
    tableLocationValue: "Fælledhuset",
    tableSizeValue: (meters: number) => `${meters} meters`,
    guidelinesTitle: "Practical information",
    guidelines: [
      "Arrive with enough time to set up your table before the market opens.",
      "Bring everything you need for pricing, displaying, and selling (price tags, bags, change, and a tablecloth or runner).",
      "If you have any special requirements, such as access to electricity, contact the organizers in advance so we can plan ahead.",
      "Stay at your table throughout the market so customers can always ask questions and buy from you.",
      "Take any unsold items and your own trash home with you, and leave your table clean and tidy.",
      "Be friendly and helpful to your neighboring sellers and visitors — that is what makes the loppemarked feel welcoming.",
    ],
    contactTitle: "Contact",
    contactText:
      "If you have any questions, feel free to reach out to the organizer:",
    closing: "We look forward to seeing you at Fælledhuset!",
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

export function buildConfirmationEmail(data: ConfirmationEmailData): EmailContent {
  const t = translations[data.language];
  const table = describeTable(data.boxId, t);

  const switchedTable =
    data.switchedFromBoxId != null
      ? describeTable(data.switchedFromBoxId, t)
      : null;

  const switchHtml = switchedTable
    ? `<div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark};">${escapeHtml(t.switchNote(switchedTable.number))}</p>
      </div>`
    : "";

  const guidelinesHtml = t.guidelines
    .map((g) => `<li style="margin-bottom: 6px;">${escapeHtml(g)}</li>`)
    .join("");

  const bodyHtml = `<!DOCTYPE html>
<html lang="${data.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t.subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: ${BRAND.pageBg}; color: ${BRAND.ink};">
  <div style="max-width: 600px; margin: 0 auto; background: ${BRAND.cream};">
    <div style="background: ${BRAND.green}; padding: 24px 32px; border-bottom: 4px solid ${BRAND.salmon};">
      <h1 style="margin: 0; color: ${BRAND.cream}; font-size: 22px; letter-spacing: 0.02em;">UN17 Village Loppemarked</h1>
    </div>

    <div style="padding: 32px;">
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.confirmationIntro)}</p>

      ${switchHtml}

      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px;">${escapeHtml(t.tableDetailsTitle)}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; width: 40%; color: ${BRAND.ink};">${escapeHtml(t.tableNumberLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.salmonDark}; font-weight: bold; font-size: 18px;">${escapeHtml(table.number)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; color: ${BRAND.ink};">${escapeHtml(t.tableSizeLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.ink};">${escapeHtml(table.size)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; color: ${BRAND.ink};">${escapeHtml(t.tableLocationLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.ink};">${escapeHtml(t.tableLocationValue)}</td>
        </tr>
      </table>

      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.guidelinesTitle)}</h2>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${guidelinesHtml}
      </ul>

      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.contactTitle)}</h2>
      <p>${escapeHtml(t.contactText)}</p>
      <p style="margin: 8px 0 0;"><a href="mailto:${escapeHtml(EVENT_CONTACT.email)}" style="color: ${BRAND.salmonDark}; font-weight: 600; text-decoration: none;">${escapeHtml(EVENT_CONTACT.name)}</a></p>

      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>
    </div>

    <div style="background: ${BRAND.salmon}; padding: 16px 32px; font-size: 12px; color: ${BRAND.cream}; text-align: center;">
      <p style="margin: 0;">UN17 Village Loppemarked &middot; Fælledhuset</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: t.subject,
    bodyHtml,
    from: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO,
  };
}
