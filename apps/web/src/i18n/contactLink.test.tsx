import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EventContactLink, renderWithContact } from "./contactLink";

describe("EventContactLink", () => {
  afterEach(cleanup);

  it("renders a single mailto link with 'Ammon Larson' as visible text", () => {
    render(<EventContactLink />);
    const link = screen.getByRole("link", { name: "Ammon Larson" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("mailto:ammonl@hotmail.com");
    expect(link.textContent).toBe("Ammon Larson");
  });
});

describe("renderWithContact", () => {
  afterEach(cleanup);

  it("substitutes the {contact} token with a single EventContactLink", () => {
    render(<p>{renderWithContact("Questions? Email {contact}")}</p>);
    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("mailto:ammonl@hotmail.com");
    expect(links[0].textContent).toBe("Ammon Larson");
    const paragraph = links[0].closest("p")!;
    expect(paragraph.textContent).toBe("Questions? Email Ammon Larson");
  });

  it("renders the template unchanged when no {contact} token is present", () => {
    render(<p data-testid="plain">{renderWithContact("No contact here.")}</p>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("plain").textContent).toBe("No contact here.");
  });

  it("does not leave the raw email as adjacent text beside the link", () => {
    render(<p data-testid="policy">{renderWithContact("Contact {contact} if needed.")}</p>);
    const paragraph = screen.getByTestId("policy");
    expect(paragraph.textContent).toBe("Contact Ammon Larson if needed.");
    expect(paragraph.textContent).not.toContain("ammonl@hotmail.com");
  });
});
