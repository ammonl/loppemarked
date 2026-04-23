import { describe, expect, it } from "vitest";
import { buildConfirmationEmail } from "./email-templates.js";

describe("buildConfirmationEmail", () => {
  const baseData = {
    recipientName: "Anna Jensen",
    recipientEmail: "anna@example.com",
    boxId: 3,
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

  it("includes Fælledhuset as the location", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Fælledhuset");
  });

  it("renders the table size", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("2 meter");

    const premium = buildConfirmationEmail({ ...baseData, boxId: 23, language: "en" });
    expect(premium.bodyHtml).toContain("3 meters");
    expect(premium.bodyHtml).toContain("#23");
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
    expect(result.replyTo).toBe("elise7284@gmail.com");
  });

  it("does not include switch note when no switch occurred", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).not.toContain("#FBEEEA");
    expect(result.bodyHtml).not.toContain("Bemærk");
    expect(result.bodyHtml).not.toContain("previous booking");
  });

  it("includes switch note when switchedFromBoxId is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      switchedFromBoxId: 7,
    });
    expect(result.bodyHtml).toContain("#7");
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml).toContain("Bemærk");
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
    const result = buildConfirmationEmail({ ...baseData, boxId: 999 });
    expect(result.bodyHtml).toContain("#999");
    expect(result.bodyHtml).toContain("—");
  });
});
