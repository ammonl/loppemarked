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
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English subject for en language", () => {
    const result = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(result.subject).toContain("Confirmation");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes recipient name in greeting", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Anna Jensen");
  });

  it("includes box details", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("Stellaria");
    expect(result.bodyHtml).toContain("Kronen");
  });

  it("includes greenhouse map with highlighted box", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("<table");
    expect(result.bodyHtml).toContain("#2e7d32");
  });

  it("includes care guidelines", () => {
    const daResult = buildConfirmationEmail(baseData);
    expect(daResult.bodyHtml).toContain("økologisk");

    const enResult = buildConfirmationEmail({ ...baseData, language: "en" });
    expect(enResult.bodyHtml).toContain("organic");
  });

  it("includes WhatsApp link", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("chat.whatsapp.com");
  });

  it("includes organizer contact info", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).toContain("elise7284@gmail.com");
  });

  it("uses correct from and replyTo addresses", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.from).toBe("loppemarked@un17hub.com");
    expect(result.replyTo).toBe("elise7284@gmail.com");
  });

  it("does not include switch note when no switch occurred", () => {
    const result = buildConfirmationEmail(baseData);
    expect(result.bodyHtml).not.toContain("ff9800");
  });

  it("includes switch note when switchedFromBoxId is provided", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      switchedFromBoxId: 7,
    });
    expect(result.bodyHtml).toContain("ff9800");
    expect(result.bodyHtml).toContain("Alder");
    expect(result.bodyHtml).toContain("Kronen");
  });

  it("renders Søen greenhouse for box 15+", () => {
    const result = buildConfirmationEmail({ ...baseData, boxId: 20 });
    expect(result.bodyHtml).toContain("Søen");
    expect(result.bodyHtml).toContain("Great tit");
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

  it("handles unknown box ID gracefully", () => {
    const result = buildConfirmationEmail({ ...baseData, boxId: 999 });
    expect(result.bodyHtml).toContain("Box 999");
    expect(result.bodyHtml).toContain("Unknown");
  });

  it("includes Søen switch note for Søen-to-Søen switch", () => {
    const result = buildConfirmationEmail({
      ...baseData,
      boxId: 20,
      switchedFromBoxId: 25,
    });
    expect(result.bodyHtml).toContain("ff9800");
    expect(result.bodyHtml).toContain("Gray goose");
    expect(result.bodyHtml).toContain("Søen");
  });
});
