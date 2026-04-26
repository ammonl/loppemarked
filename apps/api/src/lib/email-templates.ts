import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  EVENT_CONTACT,
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  formatTableSize,
  getTableById,
} from "@loppemarked/shared";
import type { Language, TableCatalogEntry } from "@loppemarked/shared";

export type ConfirmationFlow = "self" | "admin_add" | "waitlist_assign";

export interface ConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  language: Language;
  tableId: number;
  switchedFromTableId?: number;
  cancellationUrl?: string;
  /**
   * When true (and no `cancellationUrl` is supplied), render the cancel
   * section with a placeholder note instead of a clickable link. Used by the
   * admin preview API: the registration does not yet exist when the admin
   * opens the composer, so no real token can be minted, but we still want
   * the preview to show that a cancel link will appear in the sent email.
   */
  cancellationLinkPlaceholder?: boolean;
  /**
   * Which flow produced this booking. Drives the intro wording so admin-driven
   * flows say "you have been assigned a table" rather than "you have booked".
   * Defaults to "self".
   */
  flow?: ConfirmationFlow;
}

export interface CancellationConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  language: Language;
  tableId: number;
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
} as const;

interface TableSummary {
  number: string;
  size: string;
}

function describeTable(id: number): TableSummary {
  const table = getTableById(id);
  if (!table) {
    return { number: `#${id}`, size: "—" };
  }
  return {
    number: `#${table.number}`,
    size: formatTableSize(table),
  };
}

const translations = {
  da: {
    subject: "Bekræftelse af din bordbooking – UN17 Village Loppemarked",
    greeting: (name: string) => `Kære ${name},`,
    confirmationIntro:
      "Tak for din tilmelding til UN17 Village Loppemarked i Fælledhuset! Din bordbooking er nu bekræftet.",
    adminAddIntro:
      "Du er blevet tildelt et bord til UN17 Village Loppemarked i Fælledhuset. Din bordbooking er nu bekræftet.",
    waitlistAssignIntro:
      "Du er blevet tildelt et bord fra ventelisten til UN17 Village Loppemarked i Fælledhuset. Din bordbooking er nu bekræftet.",
    switchNote: (oldTableNumber: string) =>
      `Bemærk: Din tidligere reservation af bord ${oldTableNumber} er blevet frigivet, og din booking er flyttet til det bord, der er vist nedenfor.`,
    tableDetailsTitle: "Dit bord",
    tableNumberLabel: "Bordnummer",
    tableSizeLabel: "Størrelse",
    tableLocationLabel: "Placering",
    tableLocationVenue: "Fælledhuset",
    tableLocationSummary: (tableNumber: string) =>
      `Fælledhuset · Bord ${tableNumber}`,
    tableLocationFallback: (tableNumber: string) =>
      `Dit bord ${tableNumber} står i Fælledhuset. Hvis kortet ikke vises, kan du finde dit bord på plantegningen på loppemarkedssiden.`,
    tableLocationCaption: (tableNumber: string) =>
      `Bord ${tableNumber} er markeret med rødt på plantegningen over Fælledhuset.`,
    tableLocationMapTitle: (tableNumber: string) =>
      `Plantegning over Fælledhuset med bord ${tableNumber} fremhævet.`,
    tableLocationStageLabel: "Scene",
    tableLocationEntranceLabel: "Indgang",
    guidelinesTitle: "Retningslinjer for sælgere",
    guidelines: [
      "Mød op i god tid, så du er klar ved dit bord, inden markedet åbner. Opstilling begynder kl. 11.00.",
      "Medbring selv alt, hvad du skal bruge til prismærkning, opstilling og salg (fx prisskilte, poser, byttepenge og en dug eller klud).",
      "Har du særlige behov, fx adgang til strøm, så kontakt arrangørerne i god tid, så vi kan planlægge efter det.",
      "Bliv ved dit bord (eller sørg for, at en anden er ved dit bord) under hele markedet, så kunderne altid kan spørge og handle. Markedet er åbent fra kl. 12.00–14.30.",
      "Tøjstativer er kun tilladt, hvis stativplads indgår i din booking, og du skal selv medbringe dit tøjstativ.",
      "Tag alle usolgte varer og eget affald med hjem, og efterlad dit bord rent og ryddet.",
      "Vær hjælpsom og venlig over for dine nabosælgere og gæsterne – det er det, der gør loppemarkedet hyggeligt.",
    ],
    contactTitle: "Kontakt",
    contactText: "Har du spørgsmål, er du velkommen til at skrive til arrangøren:",
    cancelTitle: "Afmeld dit bord",
    cancelIntro:
      "Kan du alligevel ikke deltage? Brug linket herunder for at afmelde din bordbooking. Du bliver bedt om at bekræfte, før afmeldingen gennemføres.",
    cancelCtaLabel: "Afmeld din booking",
    cancelFallbackLabel: "Virker knappen ikke? Kopier dette link:",
    cancelNote:
      "Linket er personligt og må ikke deles. Når du har afmeldt, vil arrangørerne gennemgå bordet, før det eventuelt frigives igen.",
    cancelPlaceholderNote:
      "Et personligt afmeldingslink til modtageren indsættes her, når e-mailen sendes.",
    closing: "Vi glæder os til at se dig i Fælledhuset!",
    teamSignature: "UN17 Village Loppemarked-teamet",
    cancellationConfirmationSubject:
      "Din afmelding er bekræftet – UN17 Village Loppemarked",
    cancellationConfirmationIntro:
      "Vi bekræfter, at din bordbooking til UN17 Village Loppemarked i Fælledhuset er afmeldt.",
    cancellationConfirmationDetail: (tableNumber: string) =>
      `Din booking af bord ${tableNumber} er ikke længere aktiv.`,
    cancellationConfirmationHoldNote:
      "Bordet holdes som reserveret, indtil arrangørerne har gennemgået det. Du behøver ikke at gøre mere.",
    cancellationConfirmationMistakeNote:
      "Hvis du har afmeldt ved en fejl, skal du kontakte arrangørerne hurtigst muligt — bordet kan ikke genaktiveres automatisk.",
    cancellationConfirmationClosing:
      "Tak fordi du gav os besked.",
  },
  en: {
    subject: "Confirmation of your table booking – UN17 Village Loppemarked",
    greeting: (name: string) => `Dear ${name},`,
    confirmationIntro:
      "Thank you for signing up for UN17 Village Loppemarked at Fælledhuset! Your table booking is now confirmed.",
    adminAddIntro:
      "You have been assigned a table at UN17 Village Loppemarked at Fælledhuset. Your table booking is now confirmed.",
    waitlistAssignIntro:
      "You have been assigned a table from the waitlist for UN17 Village Loppemarked at Fælledhuset. Your table booking is now confirmed.",
    switchNote: (oldTableNumber: string) =>
      `Note: Your previous booking for table ${oldTableNumber} has been released, and your reservation has been moved to the table shown below.`,
    tableDetailsTitle: "Your table",
    tableNumberLabel: "Table number",
    tableSizeLabel: "Size",
    tableLocationLabel: "Location",
    tableLocationVenue: "Fælledhuset",
    tableLocationSummary: (tableNumber: string) =>
      `Fælledhuset · Table ${tableNumber}`,
    tableLocationFallback: (tableNumber: string) =>
      `Your table ${tableNumber} is in Fælledhuset. If the map does not display, you can locate your table on the floor plan on the loppemarked page.`,
    tableLocationCaption: (tableNumber: string) =>
      `Table ${tableNumber} is highlighted in red on the Fælledhuset floor plan.`,
    tableLocationMapTitle: (tableNumber: string) =>
      `Floor plan of Fælledhuset with table ${tableNumber} highlighted.`,
    tableLocationStageLabel: "Stage",
    tableLocationEntranceLabel: "Entrance",
    guidelinesTitle: "Seller Guidelines",
    guidelines: [
      "Arrive with enough time to set up your table before the market opens. Setup begins at 11:00 AM.",
      "Bring everything you need for pricing, displaying, and selling (price tags, bags, change, and a tablecloth or runner).",
      "If you have any special requirements, such as access to electricity, contact the organizers in advance so we can plan ahead.",
      "Stay at your table (or have someone stay at your table) throughout the market so customers can always ask questions and buy from you. The market is open from 12:00–2:30 PM.",
      "Clothing racks are only allowed if rack space is included in your booking, and you must bring your own clothing rack.",
      "Take any unsold items and your own trash home with you, and leave your table clean and tidy.",
      "Be friendly and helpful to your neighboring sellers and visitors — that is what makes the loppemarked feel welcoming.",
    ],
    contactTitle: "Contact",
    contactText:
      "If you have any questions, feel free to reach out to the organizer:",
    cancelTitle: "Cancel your booking",
    cancelIntro:
      "Need to cancel? Use the link below to release your table booking. You'll be asked to review and confirm before the cancellation is finalized.",
    cancelCtaLabel: "Cancel my booking",
    cancelFallbackLabel: "Button not working? Copy this link:",
    cancelNote:
      "This link is personal — please don't share it. After you cancel, the organizers will review the table before it may be released again.",
    cancelPlaceholderNote:
      "A personal cancellation link for the recipient will be inserted here when the email is sent.",
    closing: "We look forward to seeing you at Fælledhuset!",
    teamSignature: "The UN17 Village Loppemarked Team",
    cancellationConfirmationSubject:
      "Your cancellation is confirmed – UN17 Village Loppemarked",
    cancellationConfirmationIntro:
      "We're confirming that your table booking for UN17 Village Loppemarked at Fælledhuset has been cancelled.",
    cancellationConfirmationDetail: (tableNumber: string) =>
      `Your booking for table ${tableNumber} is no longer active.`,
    cancellationConfirmationHoldNote:
      "The table is held as reserved until the organizers review it. No further action is needed from you.",
    cancellationConfirmationMistakeNote:
      "If you cancelled by mistake, please contact the organizers as soon as possible — the table cannot be reactivated automatically.",
    cancellationConfirmationClosing:
      "Thank you for letting us know.",
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

function buildTableLocationMapSvg(
  bookedTable: TableCatalogEntry,
  t: (typeof translations)["da" | "en"],
): string {
  const { width, height } = TABLE_MAP_VIEWBOX;
  const tableLabel = `#${bookedTable.number}`;
  const titleText = t.tableLocationMapTitle(tableLabel);

  const tableTiles = TABLE_CATALOG.map((table) => {
    const isBooked = table.id === bookedTable.id;
    const fill = isBooked ? BRAND.salmon : BRAND.greenSoft;
    const stroke = isBooked ? BRAND.salmonDark : BRAND.greenDark;
    const textFill = isBooked ? BRAND.cream : BRAND.ink;
    const cx = table.x + table.width / 2;
    const cy = table.y + table.height / 2 + 1.1;
    return (
      `<rect x="${table.x}" y="${table.y}" width="${table.width}" height="${table.height}" rx="0.9" fill="${fill}" stroke="${stroke}" stroke-width="0.5"></rect>` +
      `<text x="${cx}" y="${cy}" font-size="3" font-weight="700" text-anchor="middle" fill="${textFill}" font-family="Arial, Helvetica, sans-serif">${table.number}</text>`
    );
  }).join("");

  const stageLabel = escapeHtml(t.tableLocationStageLabel);
  const entranceLabel = escapeHtml(t.tableLocationEntranceLabel);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="100%" height="auto" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" ` +
    `style="display: block; max-width: 100%; height: auto;">` +
    `<title>${escapeHtml(titleText)}</title>` +
    `<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="3" fill="${BRAND.cream}" stroke="${BRAND.greenDark}" stroke-width="0.6"></rect>` +
    `<rect x="${width / 2 - 10}" y="5.5" width="20" height="3" rx="0.6" fill="${BRAND.greenDark}" opacity="0.35"></rect>` +
    `<text x="${width / 2}" y="7.9" font-size="2.6" text-anchor="middle" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif">${stageLabel}</text>` +
    `<rect x="${width / 2 - 7}" y="${height - 5}" width="14" height="3" fill="${BRAND.greenSoft}" stroke="${BRAND.greenDark}" stroke-width="0.5"></rect>` +
    `<text x="${width / 2}" y="${height - 2.6}" font-size="2.6" text-anchor="middle" fill="${BRAND.ink}" font-family="Arial, Helvetica, sans-serif">${entranceLabel}</text>` +
    tableTiles +
    `</svg>`
  );
}

function buildTableLocationCellHtml(
  bookedTable: TableCatalogEntry | undefined,
  bookedTableLabel: string,
  t: (typeof translations)["da" | "en"],
): string {
  const summary = t.tableLocationSummary(bookedTableLabel);

  if (!bookedTable) {
    return (
      `<p style="margin: 0; font-weight: 600; color: ${BRAND.ink};">${escapeHtml(t.tableLocationVenue)}</p>` +
      `<p style="margin: 4px 0 0; font-size: 13px; color: ${BRAND.ink};">${escapeHtml(t.tableLocationFallback(bookedTableLabel))}</p>`
    );
  }

  const svg = buildTableLocationMapSvg(bookedTable, t);
  const caption = t.tableLocationCaption(bookedTableLabel);

  // The visible summary line ("Fælledhuset · Bord #3") is rendered for every
  // client. The inline SVG is wrapped in an `<!--[if !mso]>` block so Outlook
  // for Windows (Word renderer) silently skips it instead of showing broken
  // markup; those clients still see the summary line and caption text.
  return (
    `<p style="margin: 0 0 8px; font-weight: 600; color: ${BRAND.ink};">${escapeHtml(summary)}</p>` +
    `<!--[if !mso]><!-->` +
    `<div style="margin: 0 0 6px;">${svg}</div>` +
    `<p style="margin: 0; font-size: 13px; color: ${BRAND.ink};">${escapeHtml(caption)}</p>` +
    `<!--<![endif]-->`
  );
}

type Translations = (typeof translations)[keyof typeof translations];

function pickIntro(flow: ConfirmationFlow, t: Translations): string {
  switch (flow) {
    case "admin_add":
      return t.adminAddIntro;
    case "waitlist_assign":
      return t.waitlistAssignIntro;
    case "self":
      return t.confirmationIntro;
    default: {
      const _exhaustive: never = flow;
      return _exhaustive;
    }
  }
}

export function buildConfirmationEmail(data: ConfirmationEmailData): EmailContent {
  const t = translations[data.language];
  const flow: ConfirmationFlow = data.flow ?? "self";
  const introText = pickIntro(flow, t);
  const table = describeTable(data.tableId);
  const bookedTableEntry = getTableById(data.tableId);
  const locationCellHtml = buildTableLocationCellHtml(
    bookedTableEntry,
    table.number,
    t,
  );

  const switchedTable =
    data.switchedFromTableId != null
      ? describeTable(data.switchedFromTableId)
      : null;

  const switchHtml = switchedTable
    ? `<div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark};">${escapeHtml(t.switchNote(switchedTable.number))}</p>
      </div>`
    : "";

  const guidelinesHtml = t.guidelines
    .map((g) => `<li style="margin-bottom: 6px;">${escapeHtml(g)}</li>`)
    .join("");

  let cancellationHtml = "";
  if (data.cancellationUrl) {
    cancellationHtml = `<h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.cancelTitle)}</h2>
      <p>${escapeHtml(t.cancelIntro)}</p>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(data.cancellationUrl)}" style="display: inline-block; background: ${BRAND.salmon}; color: ${BRAND.cream}; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: 600;">${escapeHtml(t.cancelCtaLabel)}</a>
      </p>
      <p style="font-size: 13px; color: ${BRAND.ink}; margin-top: 12px;">${escapeHtml(t.cancelFallbackLabel)}<br><span style="word-break: break-all; color: ${BRAND.salmonDark};">${escapeHtml(data.cancellationUrl)}</span></p>
      <p style="font-size: 12px; color: ${BRAND.ink}; opacity: 0.8; margin-top: 12px;">${escapeHtml(t.cancelNote)}</p>`;
  } else if (data.cancellationLinkPlaceholder) {
    cancellationHtml = `<h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.cancelTitle)}</h2>
      <p>${escapeHtml(t.cancelIntro)}</p>
      <p style="background: ${BRAND.greenSoft}; border-left: 4px solid ${BRAND.greenDark}; padding: 10px 14px; margin: 16px 0; border-radius: 4px; font-size: 13px; color: ${BRAND.ink};"><em>${escapeHtml(t.cancelPlaceholderNote)}</em></p>
      <p style="font-size: 12px; color: ${BRAND.ink}; opacity: 0.8; margin-top: 12px;">${escapeHtml(t.cancelNote)}</p>`;
  }

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
      <p>${escapeHtml(introText)}</p>

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
          <td style="padding: 10px 12px; background: ${BRAND.greenSoft}; font-weight: bold; color: ${BRAND.ink}; vertical-align: top;">${escapeHtml(t.tableLocationLabel)}</td>
          <td style="padding: 10px 12px; color: ${BRAND.ink};">${locationCellHtml}</td>
        </tr>
      </table>

      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.guidelinesTitle)}</h2>
      <ul style="padding-left: 20px; line-height: 1.6;">
        ${guidelinesHtml}
      </ul>

      ${cancellationHtml}

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

export function buildCancellationConfirmationEmail(
  data: CancellationConfirmationEmailData,
): EmailContent {
  const t = translations[data.language];
  const table = describeTable(data.tableId);
  const subject = t.cancellationConfirmationSubject;

  const bodyHtml = `<!DOCTYPE html>
<html lang="${data.language}">
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
      <p style="margin-top: 0;">${escapeHtml(t.greeting(data.recipientName))}</p>
      <p>${escapeHtml(t.cancellationConfirmationIntro)}</p>

      <div style="background: ${BRAND.salmonSoft}; border-left: 4px solid ${BRAND.salmon}; padding: 12px 16px; margin: 16px 0 20px; border-radius: 4px;">
        <p style="margin: 0; color: ${BRAND.salmonDark}; font-weight: 600;">${escapeHtml(t.cancellationConfirmationDetail(table.number))}</p>
      </div>

      <p>${escapeHtml(t.cancellationConfirmationHoldNote)}</p>
      <p>${escapeHtml(t.cancellationConfirmationMistakeNote)}</p>

      <h2 style="color: ${BRAND.greenDark}; font-size: 18px; border-bottom: 2px solid ${BRAND.greenSoft}; padding-bottom: 8px; margin-top: 28px;">${escapeHtml(t.contactTitle)}</h2>
      <p>${escapeHtml(t.contactText)}</p>
      <p style="margin: 8px 0 0;"><a href="mailto:${escapeHtml(EVENT_CONTACT.email)}" style="color: ${BRAND.salmonDark}; font-weight: 600; text-decoration: none;">${escapeHtml(EVENT_CONTACT.name)}</a></p>

      <p style="margin-top: 28px;">${escapeHtml(t.cancellationConfirmationClosing)}</p>
      <p style="font-weight: bold; color: ${BRAND.greenDark};">${escapeHtml(t.teamSignature)}</p>
    </div>

    <div style="background: ${BRAND.salmon}; padding: 16px 32px; font-size: 12px; color: ${BRAND.cream}; text-align: center;">
      <p style="margin: 0;">UN17 Village Loppemarked &middot; Fælledhuset</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    bodyHtml,
    from: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO,
  };
}
