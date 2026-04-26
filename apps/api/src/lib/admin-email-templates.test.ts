import { describe, expect, it } from "vitest";
import { buildAdminNotification, buildBulkEmailTemplate, wrapEmailHtml } from "./admin-email-templates.js";
import type { NotificationPreviewInput } from "./admin-email-templates.js";

const baseInput: NotificationPreviewInput = {
  action: "add",
  recipientName: "Anna Jensen",
  recipientEmail: "anna@example.com",
  language: "da",
  tableId: 3,
};

describe("buildAdminNotification — add", () => {
  it("returns Danish subject for da language", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.subject).toContain("Bekræftelse");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English subject for en language", () => {
    const result = buildAdminNotification({ ...baseInput, language: "en" });
    expect(result.subject).toContain("Confirmation");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes recipient name in greeting", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.bodyHtml).toContain("Anna Jensen");
  });

  it("includes table number and size", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml).toContain("2 meter");
  });

  it("uses assignment wording instead of self-booking wording", () => {
    const daResult = buildAdminNotification(baseInput);
    expect(daResult.bodyHtml).toContain("Du er blevet tildelt et bord");
    expect(daResult.bodyHtml).not.toContain("Du har booket");

    const enResult = buildAdminNotification({ ...baseInput, language: "en" });
    expect(enResult.bodyHtml).toContain("You have been assigned a table");
    expect(enResult.bodyHtml).not.toContain("You have booked");
  });

  it("matches the self-registration email's structure: SVG map + caption", () => {
    const daResult = buildAdminNotification(baseInput);
    expect(daResult.bodyHtml).toContain("<svg");
    expect(daResult.bodyHtml).toContain("Fælledhuset · Bord #3");
    expect(daResult.bodyHtml).toContain("Bord #3 er markeret med rødt");
  });

  it("matches the self-registration email's seller-guidelines section", () => {
    const daResult = buildAdminNotification(baseInput);
    expect(daResult.bodyHtml).toContain("Retningslinjer for sælgere");
    expect(daResult.bodyHtml).toContain("prismærkning");

    const enResult = buildAdminNotification({ ...baseInput, language: "en" });
    expect(enResult.bodyHtml).toContain("Seller Guidelines");
    expect(enResult.bodyHtml).toContain("pricing");
  });

  it("does not include a cancellation link", () => {
    const daResult = buildAdminNotification(baseInput);
    expect(daResult.bodyHtml).not.toContain("Afmeld din booking");

    const enResult = buildAdminNotification({ ...baseInput, language: "en" });
    expect(enResult.bodyHtml).not.toContain("Cancel my booking");
  });

  it("does not include price or DKK", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.bodyHtml).not.toContain("DKK");
    expect(result.bodyHtml).not.toContain("Pris");
    expect(result.bodyHtml).not.toContain("Price");
  });

  it("sets correct recipient email", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.recipientEmail).toBe("anna@example.com");
  });

  it("sets correct language", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.language).toBe("da");
  });

  it("sets html lang attribute", () => {
    const daResult = buildAdminNotification(baseInput);
    expect(daResult.bodyHtml).toContain('lang="da"');

    const enResult = buildAdminNotification({ ...baseInput, language: "en" });
    expect(enResult.bodyHtml).toContain('lang="en"');
  });

  it("includes event contact info", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.bodyHtml).toContain("ammonl@hotmail.com");
    expect(result.bodyHtml).toContain("Ammon Larson");
  });

  it("does not include legacy organizer contacts", () => {
    const result = buildAdminNotification(baseInput);
    expect(result.bodyHtml).not.toContain("elise7284@gmail.com");
    expect(result.bodyHtml).not.toContain("lena.filthaut@yahoo.com");
  });

  it("escapes HTML in recipient name", () => {
    const result = buildAdminNotification({
      ...baseInput,
      recipientName: '<script>alert("xss")</script>',
    });
    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
  });
});

describe("buildAdminNotification — waitlist_assign", () => {
  const waitlistInput: NotificationPreviewInput = {
    ...baseInput,
    action: "waitlist_assign",
  };

  it("uses the same subject as the add action", () => {
    const addResult = buildAdminNotification(baseInput);
    const waitlistResult = buildAdminNotification(waitlistInput);
    expect(waitlistResult.subject).toBe(addResult.subject);
  });

  it("calls out that the table came from the waitlist in the intro", () => {
    const daResult = buildAdminNotification(waitlistInput);
    expect(daResult.bodyHtml).toContain("fra ventelisten");
    expect(daResult.bodyHtml).toContain("Du er blevet tildelt et bord");

    const enResult = buildAdminNotification({ ...waitlistInput, language: "en" });
    expect(enResult.bodyHtml).toContain("from the waitlist");
    expect(enResult.bodyHtml).toContain("You have been assigned a table");
  });

  it("matches the self-registration email's structure: SVG map + guidelines", () => {
    const daResult = buildAdminNotification(waitlistInput);
    expect(daResult.bodyHtml).toContain("<svg");
    expect(daResult.bodyHtml).toContain("Retningslinjer for sælgere");
  });

  it("does not include a cancellation link", () => {
    const daResult = buildAdminNotification(waitlistInput);
    expect(daResult.bodyHtml).not.toContain("Afmeld din booking");
  });
});

describe("buildAdminNotification — move", () => {
  const moveInput: NotificationPreviewInput = {
    action: "move",
    recipientName: "Anna Jensen",
    recipientEmail: "anna@example.com",
    language: "da",
    tableId: 20,
    oldTableId: 3,
  };

  it("returns Danish move subject", () => {
    const result = buildAdminNotification(moveInput);
    expect(result.subject).toContain("Ændring");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English move subject", () => {
    const result = buildAdminNotification({ ...moveInput, language: "en" });
    expect(result.subject).toContain("Change");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes old and new table numbers", () => {
    const result = buildAdminNotification(moveInput);
    expect(result.bodyHtml).toContain("#3");
    expect(result.bodyHtml).toContain("#20");
  });

  it("includes move detail callout with brand salmon styling", () => {
    const result = buildAdminNotification(moveInput);
    expect(result.bodyHtml).toContain("#C6705D");
    expect(result.bodyHtml).toContain("#A85544");
  });

  it("includes new table details table with number and size", () => {
    const result = buildAdminNotification(moveInput);
    expect(result.bodyHtml).toContain("#20");
    expect(result.bodyHtml).toContain("2 m");
  });

  it("includes event contact info", () => {
    const result = buildAdminNotification(moveInput);
    expect(result.bodyHtml).toContain("ammonl@hotmail.com");
  });
});

describe("buildAdminNotification — remove", () => {
  const removeInput: NotificationPreviewInput = {
    action: "remove",
    recipientName: "Anna Jensen",
    recipientEmail: "anna@example.com",
    language: "da",
    tableId: 3,
  };

  it("returns Danish remove subject", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.subject).toContain("fjernet");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("returns English remove subject", () => {
    const result = buildAdminNotification({ ...removeInput, language: "en" });
    expect(result.subject).toContain("removed");
    expect(result.subject).toContain("UN17 Village Loppemarked");
  });

  it("includes removed table number", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.bodyHtml).toContain("#3");
  });

  it("includes remove detail callout with brand salmon styling", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.bodyHtml).toContain("#C6705D");
    expect(result.bodyHtml).toContain("#A85544");
  });

  it("does not include table details section for remove action", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.bodyHtml).not.toContain("tableDetailsTitle");
  });

  it("includes event contact info", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.bodyHtml).toContain("ammonl@hotmail.com");
  });

  it("includes UN17 Village Loppemarked header with brand green", () => {
    const result = buildAdminNotification(removeInput);
    expect(result.bodyHtml).toContain("UN17 Village Loppemarked");
    expect(result.bodyHtml).toContain("#8DA88D");
  });
});

describe("buildAdminNotification — unknown table", () => {
  it("handles unknown table ID gracefully", () => {
    const result = buildAdminNotification({ ...baseInput, tableId: 999 });
    expect(result.bodyHtml).toContain("#999");
    expect(result.bodyHtml).toContain("\u2014");
  });
});

describe("buildBulkEmailTemplate", () => {
  it("returns Danish template", () => {
    const result = buildBulkEmailTemplate("da");
    expect(result).toContain("Kære beboer,");
    expect(result).toContain("Skriv dit budskab her...");
    expect(result).toContain("Med venlig hilsen,");
    expect(result).toContain("UN17 Village Loppemarked-teamet");
  });

  it("returns English template", () => {
    const result = buildBulkEmailTemplate("en");
    expect(result).toContain("Dear resident,");
    expect(result).toContain("Write your message here...");
    expect(result).toContain("Best regards,");
    expect(result).toContain("The UN17 Village Loppemarked Team");
  });

  it("returns valid HTML with paragraph tags", () => {
    const result = buildBulkEmailTemplate("da");
    expect(result).toContain("<p");
    expect(result).toContain("</p>");
  });
});

describe("wrapEmailHtml", () => {
  it("wraps content with DOCTYPE and html structure", () => {
    const result = wrapEmailHtml("da", "Test Subject", "<p>Hello</p>");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("</html>");
  });

  it("sets correct lang attribute", () => {
    const da = wrapEmailHtml("da", "Emne", "<p>Hej</p>");
    expect(da).toContain('lang="da"');

    const en = wrapEmailHtml("en", "Subject", "<p>Hi</p>");
    expect(en).toContain('lang="en"');
  });

  it("includes brand green header with project name", () => {
    const result = wrapEmailHtml("en", "Test", "<p>Body</p>");
    expect(result).toContain("UN17 Village Loppemarked");
    expect(result).toContain("#8DA88D");
    expect(result).toContain("#C6705D");
  });

  it("does not use legacy palette colors", () => {
    const result = wrapEmailHtml("en", "Test", "<p>Body</p>");
    expect(result).not.toContain("#2e7d32");
    expect(result).not.toContain("#e8f5e9");
  });

  it("includes footer referencing Fælledhuset", () => {
    const result = wrapEmailHtml("en", "Test", "<p>Body</p>");
    expect(result).toContain("Fælledhuset");
  });

  it("includes the content html in the body", () => {
    const result = wrapEmailHtml("en", "Test", "<p>Custom content here</p>");
    expect(result).toContain("<p>Custom content here</p>");
  });

  it("escapes subject in title tag", () => {
    const result = wrapEmailHtml("en", '<script>alert("xss")</script>', "<p>Body</p>");
    expect(result).not.toContain("<script>alert");
    expect(result).toContain("&lt;script&gt;");
  });

  it("includes subject in the title element", () => {
    const result = wrapEmailHtml("en", "My Newsletter", "<p>Body</p>");
    expect(result).toContain("<title>My Newsletter</title>");
  });
});
