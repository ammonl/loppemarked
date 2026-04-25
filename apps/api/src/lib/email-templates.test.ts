import { describe, expect, it } from "vitest";
import { buildConfirmationEmail } from "./email-templates.js";

describe("buildConfirmationEmail", () => {
  const baseData = {
    recipientName: "Anna Jensen",
    recipientEmail: "anna@example.com",
    tableId: 3,
    language: "da" as const,
  };

  it("returns Danish subject for da language", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.subject).toContain("Bekræftelse");
    expect(result.subject).toContain("bordbooking");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English subject for en language", () => {
    const result = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(result.subject).toContain("Confirmation");
    expect(result.subject).toContain("table booking");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes recipient name in greeting", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Anna Jensen");
  });

  it("renders the booked table number instead of a planter box", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml.toLowerCase()).not.toContain("planter box");
    expect(result.bodyHtml.toLowerCase()).not.toContain("plantekasse");
    expect(result.bodyHtml.toLowerCase()).not.toContain("greenhouse");
    expect(result.bodyHtml.toLowerCase()).not.toContain("drivhus");
  });

  it("renders an inline SVG floor plan instead of a textual location", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("<svg");
    expect(result.bodyHtml).toContain('viewBox="0 0 120 95"');
    // The booking-details location row no longer renders the bare text
    // `Fælledhuset` as a standalone value — it shows a summary line plus an
    // SVG and caption referencing the booked table number.
    expect(result.bodyHtml).toContain("Fælledhuset · Bord #3");
    expect(result.bodyHtml).toContain("Bord #3 er markeret med rødt");
  });

  it("highlights the booked table tile in the SVG with the brand salmon fill", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toMatch(/fill="#C6705D"/);
  });

  it("uses an SVG <title> for accessibility instead of aria-label", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("<title>Plantegning over Fælledhuset");
    expect(result.bodyHtml).toContain("bord #3 fremhævet");
    expect(result.bodyHtml).not.toMatch(/aria-label="Plantegning/);
  });

  it("renders one tile per catalog entry", () => {
    const result = buildConfirmationEmail(baseData);
    const tileMatches = result.bodyHtml.match(/<rect x="\d+(?:\.\d+)?" y="\d+(?:\.\d+)?" width="\d+(?:\.\d+)?" height="\d+(?:\.\d+)?" rx="0\.9"/g);
    expect(tileMatches).not.toBeNull();
    expect(tileMatches).toHaveLength(23);
  });

  it("wraps the SVG in an Outlook-skipping conditional comment", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("<!--[if !mso]><!-->");
    expect(result.bodyHtml).toContain("<!--<![endif]-->");
  });

  it("renders an English summary and caption when language is en", () => {
    const result = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(result.bodyHtml).toContain("Fælledhuset · Table #3");
    expect(result.bodyHtml).toContain("Table #3 is highlighted in red on the Fælledhuset floor plan");
  });

  it("falls back to text-only location info when the table id is unknown", () => {
    const result = buildConfirmationEmail({ ...baseData, tableId: 999 });
    // No SVG is rendered for an unknown table — the recipient still sees the
    // venue name and a textual fallback.
    expect(result.bodyHtml).not.toContain("<svg");
    expect(result.bodyHtml).toContain("Fælledhuset");
    expect(result.bodyHtml).toContain("Dit bord #999 står i Fælledhuset");
  });

  it("falls back to English text-only location info when the table id is unknown", () => {
    const result = buildConfirmationEmail({ ...baseData, language: "en", tableId: 999 });
    expect(result.bodyHtml).not.toContain("<svg");
    expect(result.bodyHtml).toContain("Your table #999 is in Fælledhuset");
  });

  it("still references Fælledhuset in the email footer and intro", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Fælledhuset");
  });

  it("renders the table size", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("2 meter");

    // Every visible table on the simplified Fælledhuset map is 2 m.
    const enResult = buildConfirmationEmail({ ...baseData, tableId: 23, language: "en" });
    expect(enResult.bodyHtml).toContain("2 meters");
    expect(enResult.bodyHtml).toContain("#23");
  });

  it("uses brand green and salmon colors", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("#8DA88D");
    expect(result.bodyHtml).toContain("#C6705D");
  });

  it("includes loppemarked setup/sales guidelines", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("prismærkning");
    expect(daResult.bodyHtml).toContain("strøm");

    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain("pricing");
    expect(enResult.bodyHtml).toContain("electricity");
  });

  it("renames the guidelines section to Seller Guidelines", () => {
    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain("Seller Guidelines");
    expect(enResult.bodyHtml).not.toContain("Practical information");

    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("Retningslinjer for sælgere");
    expect(daResult.bodyHtml).not.toContain("Praktisk information");
  });

  it("includes the setup-time guideline (11:00 AM)", () => {
    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain("Setup begins at 11:00 AM.");

    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("Opstilling begynder kl. 11.00.");
  });

  it("includes the attendance guideline with proxy + market hours", () => {
    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain("have someone stay at your table");
    expect(enResult.bodyHtml).toContain("12:00–2:30 PM");

    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("eller sørg for, at en anden er ved dit bord");
    expect(daResult.bodyHtml).toContain("12.00–14.30");
  });

  it("includes the clothing-rack guideline", () => {
    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain(
      "Clothing racks are only allowed if rack space is included in your booking",
    );
    expect(enResult.bodyHtml).toContain("you must bring your own clothing rack");

    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain(
      "Tøjstativer er kun tilladt, hvis stativplads indgår i din booking",
    );
    expect(daResult.bodyHtml).toContain("du skal selv medbringe dit tøjstativ");
  });

  it("does not include a community or WhatsApp section", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml.toLowerCase()).not.toContain("whatsapp");
    expect(daResult.bodyHtml).not.toContain("Fællesskab");

    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml.toLowerCase()).not.toContain("whatsapp");
    expect(enResult.bodyHtml.toLowerCase()).not.toContain("community");
  });

  it("renders Ammon Larson as the sole contact", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Ammon Larson");
    expect(result.bodyHtml).toContain("mailto:ammonl@hotmail.com");
    expect(result.bodyHtml).not.toContain("elise7284@gmail.com");
    expect(result.bodyHtml).not.toContain("lena.filthaut@yahoo.com");
  });

  it("uses correct from and replyTo addresses", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.from).toBe("loppemarked@un17hub.com");
    expect(result.replyTo).toBe("ammonl@hotmail.com");
  });

  it("does not include switch note when no switch occurred", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).not.toContain("#FBEEEA");
    expect(result.bodyHtml).not.toContain("Bemærk");
    expect(result.bodyHtml).not.toContain("previous booking");
  });

  it("includes switch note when switchedFromTableId is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      switchedFromTableId: 7,
    });
    expect(result.bodyHtml).toContain("#7");
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml).toContain("Bemærk");
  });

  it("includes English switch note when switchedFromTableId is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      language: "en",
      switchedFromTableId: 7,
    });
    expect(result.bodyHtml).toContain("#7");
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml).toContain("previous booking");
  });

  it("sets html lang attribute to match language", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain('lang="da"');

    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain('lang="en"');
  });

  it("escapes HTML in recipient name", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      recipientName: '<script>alert("xss")</script>',
    });
    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });

  it("escapes single quotes in recipient name", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      recipientName: "O'Brien",
    });
    expect(result.bodyHtml).toContain("O&#39;Brien");
  });

  it("handles unknown table ID gracefully", () => {
    const result = buildConfirmationEmail({ ...baseData, tableId: 999 });
    expect(result.bodyHtml).toContain("#999");
    expect(result.bodyHtml).toContain("—");
  });

  it("omits cancellation section when cancellationUrl is not provided", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).not.toContain("Afmeld");
    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).not.toContain("Cancel");
  });

  it("includes Danish cancellation section when cancellationUrl is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      cancellationUrl: "https://example.test/cancel?token=abc123",
    });
    expect(result.bodyHtml).toContain("Afmeld");
    expect(result.bodyHtml).toContain("https://example.test/cancel?token=abc123");
  });

  it("includes English cancellation section when cancellationUrl is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      language: "en",
      cancellationUrl: "https://example.test/cancel?token=abc123",
    });
    expect(result.bodyHtml).toContain("Cancel my booking");
    expect(result.bodyHtml).toContain("https://example.test/cancel?token=abc123");
  });

  it("escapes malicious characters in cancellationUrl", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      cancellationUrl: 'https://example.test/cancel?token=abc"><script>alert(1)</script>',
    });
    expect(result.bodyHtml).not.toContain("<script>alert(1)</script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });
});
