import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { NotificationComposer } from "./NotificationComposer";

const stableT = (key: string) => key;
vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", setLanguage: vi.fn(), t: stableT }),
}));

const baseProps = {
  action: "add" as const,
  recipientName: "Alice",
  recipientEmail: "alice@test.com",
  recipientLanguage: "en",
  tableId: 1,
  value: { sendEmail: true, subject: "Test Subject", bodyHtml: "<p>Test</p>", valid: true },
  onChange: vi.fn(),
};

function mockFetchPreview(ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => ({
      subject: "Default Subject",
      bodyHtml: "<p>Default body</p>",
      recipientEmail: "alice@test.com",
      language: "en",
    }),
  });
}

describe("NotificationComposer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("fetches preview on mount and calls onChange with result", async () => {
    const fetchMock = mockFetchPreview();
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    await act(async () => {
      render(<NotificationComposer {...baseProps} onChange={onChange} />);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/notifications/preview",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Default Subject", bodyHtml: "<p>Default body</p>", valid: true }),
    );
  });

  it("defaults to preview tab showing iframe", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());

    await act(async () => {
      render(<NotificationComposer {...baseProps} />);
    });

    const previewTab = screen.getByRole("tab", { name: "admin.notification.preview" });
    expect(previewTab.getAttribute("aria-selected")).toBe("true");

    const iframe = screen.getByTitle("admin.notification.preview");
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("sandbox")).toBe("");
  });

  it("switches to source tab and shows textarea", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());

    await act(async () => {
      render(<NotificationComposer {...baseProps} />);
    });

    const sourceTab = screen.getByRole("tab", { name: "admin.notification.source" });
    fireEvent.click(sourceTab);

    expect(sourceTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "admin.notification.preview" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByLabelText("admin.notification.body")).toBeDefined();
  });

  it("shows send checkbox and subject field when sendEmail is true", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());

    await act(async () => {
      render(<NotificationComposer {...baseProps} />);
    });

    expect(screen.getByText("admin.notification.send")).toBeDefined();
    expect(screen.getByLabelText("admin.notification.subject")).toBeDefined();
  });

  it("hides subject and tabs when sendEmail is false", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());

    await act(async () => {
      render(
        <NotificationComposer
          {...baseProps}
          value={{ sendEmail: false, subject: "", bodyHtml: "", valid: true }}
        />,
      );
    });

    expect(screen.queryByLabelText("admin.notification.subject")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("calls onChange when subject is edited", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());
    const onChange = vi.fn();

    await act(async () => {
      render(<NotificationComposer {...baseProps} onChange={onChange} />);
    });

    const subjectInput = screen.getByLabelText("admin.notification.subject");
    fireEvent.change(subjectInput, { target: { value: "New Subject" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "New Subject" }),
    );
  });

  it("calls onChange with valid flag when body is edited in source tab", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());
    const onChange = vi.fn();

    await act(async () => {
      render(<NotificationComposer {...baseProps} onChange={onChange} />);
    });

    const sourceTab = screen.getByRole("tab", { name: "admin.notification.source" });
    fireEvent.click(sourceTab);

    const bodyTextarea = screen.getByLabelText("admin.notification.body");
    fireEvent.change(bodyTextarea, { target: { value: "<p>Updated</p>" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyHtml: "<p>Updated</p>", valid: true }),
    );
  });

  it("sets valid to false when body is empty", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());
    const onChange = vi.fn();

    await act(async () => {
      render(<NotificationComposer {...baseProps} onChange={onChange} />);
    });

    const sourceTab = screen.getByRole("tab", { name: "admin.notification.source" });
    fireEvent.click(sourceTab);

    const bodyTextarea = screen.getByLabelText("admin.notification.body");
    fireEvent.change(bodyTextarea, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyHtml: "", valid: false }),
    );
  });

  it("shows validation error when body is invalid", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());

    await act(async () => {
      render(
        <NotificationComposer
          {...baseProps}
          value={{ sendEmail: true, subject: "Sub", bodyHtml: "", valid: false }}
        />,
      );
    });

    const sourceTab = screen.getByRole("tab", { name: "admin.notification.source" });
    fireEvent.click(sourceTab);

    expect(screen.getByText("admin.notification.sourceError")).toBeDefined();
  });

  it("shows error when preview fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await act(async () => {
      render(<NotificationComposer {...baseProps} />);
    });

    expect(screen.getByText("admin.notification.previewError")).toBeDefined();
  });

  it("resets to default when reset button is clicked", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());
    const onChange = vi.fn();

    await act(async () => {
      render(<NotificationComposer {...baseProps} onChange={onChange} />);
    });

    const resetButton = screen.getByText("admin.notification.reset");
    fireEvent.click(resetButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Default Subject", bodyHtml: "<p>Default body</p>", valid: true }),
    );
  });

  it("does not fetch preview when required fields are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(
        <NotificationComposer
          {...baseProps}
          recipientName=""
          recipientEmail=""
          tableId={0}
        />,
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preview tab reflects current bodyHtml in iframe srcDoc", async () => {
    vi.stubGlobal("fetch", mockFetchPreview());
    const customHtml = "<h1>Custom</h1>";

    await act(async () => {
      render(
        <NotificationComposer
          {...baseProps}
          value={{ sendEmail: true, subject: "Sub", bodyHtml: customHtml, valid: true }}
        />,
      );
    });

    const iframe = screen.getByTitle("admin.notification.preview") as HTMLIFrameElement;
    expect(iframe.getAttribute("srcdoc")).toBe(customHtml);
  });
});
