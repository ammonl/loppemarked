import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WaitlistBanner } from "./WaitlistBanner";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", ready: true, setLanguage: vi.fn(), t: (key: string) => key }),
}));

describe("WaitlistBanner", () => {
  afterEach(cleanup);

  it("renders title and email follow-up message", () => {
    render(<WaitlistBanner />);
    expect(screen.getByText("waitlist.title")).toBeDefined();
    expect(screen.getByText("waitlist.emailFollowUp")).toBeDefined();
  });

  it("does not render the all-booked description on the confirmation banner", () => {
    render(<WaitlistBanner />);
    expect(screen.queryByText("waitlist.description")).toBeNull();
  });

  it("shows already-on-waitlist message when alreadyOnWaitlist is true", () => {
    render(<WaitlistBanner alreadyOnWaitlist />);
    expect(screen.getByText("waitlist.alreadyOnWaitlist")).toBeDefined();
    expect(screen.getByText("waitlist.emailFollowUp")).toBeDefined();
  });

  it("does not render already-on-waitlist message when alreadyOnWaitlist is false", () => {
    render(<WaitlistBanner />);
    expect(screen.queryByText("waitlist.alreadyOnWaitlist")).toBeNull();
  });

  it("shows position when provided", () => {
    render(<WaitlistBanner position={3} />);
    expect(screen.getByText("waitlist.positionLabel: #3")).toBeDefined();
  });

  it("renders position alongside the email follow-up on the happy path", () => {
    render(<WaitlistBanner position={3} />);
    expect(screen.getByText("waitlist.positionLabel: #3")).toBeDefined();
    expect(screen.getByText("waitlist.emailFollowUp")).toBeDefined();
  });

  it("does not show position when null", () => {
    render(<WaitlistBanner position={null} />);
    expect(screen.queryByText(/positionLabel/)).toBeNull();
  });

  it("does not render join button when onJoinWaitlist is not provided", () => {
    render(<WaitlistBanner />);
    expect(screen.queryByText("waitlist.joinButton")).toBeNull();
  });

  it("renders join button when onJoinWaitlist is provided", () => {
    const handler = vi.fn();
    render(<WaitlistBanner onJoinWaitlist={handler} />);
    const button = screen.getByText("waitlist.joinButton");
    expect(button).toBeDefined();
  });

  it("calls onJoinWaitlist when button is clicked", () => {
    const handler = vi.fn();
    render(<WaitlistBanner onJoinWaitlist={handler} />);
    fireEvent.click(screen.getByText("waitlist.joinButton"));
    expect(handler).toHaveBeenCalledOnce();
  });
});
