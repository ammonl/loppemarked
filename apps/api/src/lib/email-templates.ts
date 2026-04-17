import {
  BOX_CATALOG,
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  ORGANIZER_CONTACTS,
  WHATSAPP_GROUP_URL,
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

const translations = {
  da: {
    subject: "Bekræftelse af din plantekasse-registrering – UN17 Village Loppemarked",
    greeting: (name: string) => `Kære ${name},`,
    confirmationIntro:
      "Tak for din tilmelding til UN17 Village Loppemarked! Din registrering er nu bekræftet.",
    switchNote: (oldBoxName: string, oldGreenhouse: string) =>
      `Bemærk: Din tidligere plantekasse "${oldBoxName}" i ${oldGreenhouse} er blevet frigivet, og din registrering er flyttet til den nye kasse nedenfor.`,
    boxDetailsTitle: "Din plantekasse",
    boxLabel: "Kasse",
    greenhouseLabel: "Drivhus",
    careTitle: "Retningslinjer for pasning",
    careGuidelines: [
      "Planter skal være plantet inden for én uge efter reservationens start. Dette sikrer, at den 2 måneders reservation forløber smidigt og er fair over for dem, der venter.",
      "Hvis planterne ikke er startet, mistes pladsen, og den går videre til næste person på ventelisten.",
      "Hold plantebordet ved at vande og luge regelmæssigt.",
      "Brug kun økologiske og miljøvenlige havebrugsmetoder.",
      "Høst ikke fra andre planteborde uden tilladelse.",
    ],
    whatsappTitle: "Fællesskab",
    whatsappText:
      "Deltag i Gardens & Rooftops gruppen i vores WhatsApp community for at holde dig opdateret og forbinde med andre grønne naboer:",
    whatsappLink: "Deltag i WhatsApp-gruppen",
    contactTitle: "Kontakt",
    contactText: "Hvis du har spørgsmål, er du velkommen til at kontakte os:",
    closing: "Vi glæder os til at se dig i drivhuset!",
    teamSignature: "UN17 Village Loppemarked-teamet",
  },
  en: {
    subject:
      "Confirmation of your planter box registration – UN17 Village Loppemarked",
    greeting: (name: string) => `Dear ${name},`,
    confirmationIntro:
      "Thank you for signing up for UN17 Village Loppemarked! Your registration is now confirmed.",
    switchNote: (oldBoxName: string, oldGreenhouse: string) =>
      `Note: Your previous planter box "${oldBoxName}" in ${oldGreenhouse} has been released, and your registration has been moved to the new box below.`,
    boxDetailsTitle: "Your planter box",
    boxLabel: "Box",
    greenhouseLabel: "Greenhouse",
    careTitle: "Care guidelines",
    careGuidelines: [
      "Plants must be planted within one week of your reservation start date. This keeps the 2-month reservations moving and ensures fairness for those waiting.",
      "If plants are not started, the spot will be forfeited to the next person in line.",
      "Maintain the garden bed by watering and weeding regularly.",
      "Use only organic and eco-friendly gardening methods.",
      "Do not harvest from other beds without permission.",
    ],
    whatsappTitle: "Community",
    whatsappText:
      "Join the Gardens & Rooftops group in our WhatsApp community to stay updated and connect with fellow green neighbors:",
    whatsappLink: "Join the WhatsApp group",
    contactTitle: "Contact",
    contactText:
      "If you have any questions, feel free to reach out to us:",
    closing: "We look forward to seeing you in the greenhouse!",
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
  const box = BOX_CATALOG.find((b) => b.id === data.boxId);
  const boxName = box?.name ?? `Box ${data.boxId}`;
  const greenhouse = box?.greenhouse ?? "Unknown";

  const switchedBox = data.switchedFromBoxId
    ? BOX_CATALOG.find((b) => b.id === data.switchedFromBoxId)
    : null;

  const switchHtml = switchedBox
    ? `<div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #e65100;">${escapeHtml(t.switchNote(switchedBox.name, switchedBox.greenhouse))}</p>
      </div>`
    : "";

  const careListHtml = t.careGuidelines
    .map((g) => `<li style="margin-bottom: 6px;">${escapeHtml(g)}</li>`)
    .join("");

  const contactListHtml = ORGANIZER_CONTACTS.map(
    (c) =>
      `<li><a href="mailto:${escapeHtml(c.email)}" style="color: #2e7d32;">${escapeHtml(c.name)}</a></li>`,
  ).join("");

  const bodyHtml = `<!DOCTYPE html>
<html lang="${data.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t.subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <div style="background: #2e7d32; padding: 24px 32px;">
      <h1 style="margin: 0; color: #fff; font-size: 22px;">UN17 Village Loppemarked</h1>
    </div>

    <div style="padding: 32px;">
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.confirmationIntro)}</p>

      ${switchHtml}

      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px;">${escapeHtml(t.boxDetailsTitle)}</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold; width: 40%;">${escapeHtml(t.boxLabel)}</td>
          <td style="padding: 8px 12px;">${escapeHtml(boxName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f5f5; font-weight: bold;">${escapeHtml(t.greenhouseLabel)}</td>
          <td style="padding: 8px 12px;">${escapeHtml(greenhouse)}</td>
        </tr>
      </table>

      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.careTitle)}</h2>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${careListHtml}
      </ul>

      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px;">${escapeHtml(t.whatsappTitle)}</h2>
      <p>${escapeHtml(t.whatsappText)}</p>
      <p><a href="${WHATSAPP_GROUP_URL}" style="display: inline-block; background: #2e7d32; color: #fff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold;">${escapeHtml(t.whatsappLink)}</a></p>

      <h2 style="color: #2e7d32; font-size: 18px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px;">${escapeHtml(t.contactTitle)}</h2>
      <p>${escapeHtml(t.contactText)}</p>
      <ul style="padding-left: 20px; line-height: 1.8;">
        ${contactListHtml}
      </ul>

      <p style="margin-top: 28px;">${escapeHtml(t.closing)}</p>
      <p style="font-weight: bold;">${escapeHtml(t.teamSignature)}</p>
    </div>

    <div style="background: #f5f5f5; padding: 16px 32px; font-size: 12px; color: #888; text-align: center;">
      <p style="margin: 0;">UN17 Village Loppemarked &ndash; UN17 Hub</p>
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
