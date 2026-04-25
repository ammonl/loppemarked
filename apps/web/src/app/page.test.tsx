import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import {
  DEFAULT_OPENING_DATETIME,
  OPENING_TIMEZONE,
  LANGUAGES,
  LANGUAGE_LABELS,
  ORGANIZER_CONTACTS,
  TABLE_CATALOG,
  TOTAL_TABLE_COUNT,
  VISIBLE_TABLE_IDS,
  BOX_STATES,
} from "@loppemarked/shared";
import { translations, type TranslationKey } from "@/i18n/translations";
import { isBeforeOpening } from "@/utils/opening";

describe("shared package integration", () => {
  it("exports the table catalog", () => {
    expect(TABLE_CATALOG.length).toBeGreaterThan(0);
  });

  it("exports opening datetime and timezone", () => {
    expect(DEFAULT_OPENING_DATETIME).toBe("2026-04-01T10:00:00");
    expect(OPENING_TIMEZONE).toBe("Europe/Copenhagen");
  });

  it("exports supported languages", () => {
    expect(LANGUAGES).toContain("da");
    expect(LANGUAGES).toContain("en");
  });

  it("exports organizer contacts", () => {
    expect(ORGANIZER_CONTACTS.length).toBeGreaterThan(0);
    for (const contact of ORGANIZER_CONTACTS) {
      expect(contact.name).toBeTruthy();
      expect(contact.email).toBeTruthy();
    }
  });
});

describe("translations", () => {
  it("provides translations for all supported languages", () => {
    for (const lang of LANGUAGES) {
      expect(translations[lang]).toBeDefined();
    }
  });

  it("has matching keys across da and en", () => {
    const daKeys = Object.keys(translations.da).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(daKeys).toEqual(enKeys);
  });

  it("has no empty translation values", () => {
    for (const lang of LANGUAGES) {
      for (const [key, value] of Object.entries(translations[lang])) {
        expect(value.length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("includes language labels for selector", () => {
    expect(LANGUAGE_LABELS.da).toBe("Dansk");
    expect(LANGUAGE_LABELS.en).toBe("English");
  });

  it("includes map state translations for all box states", () => {
    for (const lang of LANGUAGES) {
      for (const state of BOX_STATES) {
        const key = `map.state.${state}` as TranslationKey;
        expect(translations[lang][key], `${lang}.${key} missing`).toBeDefined();
      }
    }
  });

  it("includes map navigation translations", () => {
    for (const lang of LANGUAGES) {
      expect(translations[lang]["map.viewMap"]).toBeTruthy();
      expect(translations[lang]["map.back"]).toBeTruthy();
      expect(translations[lang]["map.legend"]).toBeTruthy();
    }
  });

  it("includes waitlist translations", () => {
    const waitlistKeys: TranslationKey[] = [
      "waitlist.title",
      "waitlist.description",
      "waitlist.joinButton",
      "waitlist.positionLabel",
      "waitlist.alreadyOnWaitlist",
      "waitlist.emailFollowUp",
      "waitlist.success",
    ];
    for (const lang of LANGUAGES) {
      for (const key of waitlistKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes email translations", () => {
    const emailKeys: TranslationKey[] = [
      "email.confirmationSubject",
      "email.switchNote",
      "email.careGuidelines",
    ];
    for (const lang of LANGUAGES) {
      for (const key of emailKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes audit timeline translations", () => {
    const auditKeys: TranslationKey[] = [
      "audit.title",
      "audit.timestamp",
      "audit.action",
      "audit.actor",
      "audit.details",
      "audit.noEvents",
      "audit.loadMore",
      "audit.filterByAction",
      "audit.filterByActor",
      "audit.allActions",
      "audit.allActors",
      "audit.detail.name",
      "audit.detail.email",
      "audit.detail.address",
      "audit.detail.recipient",
      "audit.detail.subject",
      "audit.detail.table",
      "audit.detail.stateChange",
      "audit.detail.action",
      "audit.detail.before",
      "audit.detail.after",
      "audit.detail.reason",
    ];
    for (const lang of LANGUAGES) {
      for (const key of auditKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes registration form translations", () => {
    const registrationKeys: TranslationKey[] = [
      "registration.formTitle",
      "registration.nameLabel",
      "registration.emailLabel",
      "registration.streetLabel",
      "registration.houseNumberLabel",
      "registration.floorLabel",
      "registration.doorLabel",
      "registration.tableLabel",
      "registration.switchWarning",
      "registration.switchConfirm",
      "registration.switchTitle",
      "registration.switchCurrentTable",
      "registration.switchNewTable",
      "registration.switchExplainer",
      "registration.switchKeep",
      "registration.success",
      "registration.unregisterInfo",
    ];
    for (const lang of LANGUAGES) {
      for (const key of registrationKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes validation translations", () => {
    const validationKeys: TranslationKey[] = [
      "validation.emailRequired",
      "validation.emailInvalid",
      "validation.nameRequired",
      "validation.streetInvalid",
      "validation.houseNumberInvalid",
      "validation.floorDoorRequired",
      "validation.tableIdInvalid",
    ];
    for (const lang of LANGUAGES) {
      for (const key of validationKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes consent translations", () => {
    const consentKeys: TranslationKey[] = [
      "consent.title",
      "consent.dataCollected",
      "consent.purpose",
      "consent.retention",
      "consent.contact",
      "consent.acknowledgment",
      "consent.required",
    ];
    for (const lang of LANGUAGES) {
      for (const key of consentKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes policy translations", () => {
    const policyKeys: TranslationKey[] = [
      "policy.oneApartmentRule",
      "policy.noSelfUnregister",
    ];
    for (const lang of LANGUAGES) {
      for (const key of policyKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes address/DAWA translations", () => {
    const addressKeys: TranslationKey[] = [
      "address.searchPlaceholder",
      "address.searchHint",
      "address.noResults",
      "address.selectedAddress",
      "address.changeAddress",
      "address.ineligible",
      "address.floorDoorHint",
    ];
    for (const lang of LANGUAGES) {
      for (const key of addressKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });

  it("includes admin translations", () => {
    const adminKeys: TranslationKey[] = [
      "admin.link",
      "admin.login",
      "admin.email",
      "admin.password",
      "admin.loginFailed",
      "admin.backToPublic",
      "admin.openingTimeTitle",
      "admin.openingTimeDescription",
      "admin.currentValue",
      "admin.lastUpdated",
      "admin.newOpeningTime",
      "admin.save",
      "admin.settingsSaved",
      "admin.tab.registrations",
      "admin.tab.waitlist",
      "admin.tab.tables",
      "admin.tab.settings",
      "admin.tab.audit",
      "admin.registrations.title",
      "admin.registrations.name",
      "admin.registrations.email",
      "admin.registrations.table",
      "admin.registrations.apartment",
      "admin.registrations.status",
      "admin.registrations.date",
      "admin.registrations.actions",
      "admin.registrations.remove",
      "admin.registrations.noRegistrations",
      "admin.registrations.confirmRemove",
      "admin.registrations.removed",
      "admin.waitlist.title",
      "admin.waitlist.name",
      "admin.waitlist.email",
      "admin.waitlist.apartment",
      "admin.waitlist.status",
      "admin.waitlist.date",
      "admin.waitlist.actions",
      "admin.waitlist.assign",
      "admin.waitlist.noEntries",
      "admin.waitlist.assigned",
      "admin.waitlist.assignTableId",
      "admin.waitlist.confirmAssign",
      "admin.tables.title",
      "admin.tables.number",
      "admin.tables.size",
      "admin.tables.state",
    ];
    for (const lang of LANGUAGES) {
      for (const key of adminKeys) {
        expect(translations[lang][key], `${lang}.${key} missing`).toBeTruthy();
      }
    }
  });
});

describe("table catalog", () => {
  it("matches the visible table id list", () => {
    expect(TABLE_CATALOG.map((t) => t.id)).toEqual([...VISIBLE_TABLE_IDS]);
    expect(TABLE_CATALOG.length).toBe(TOTAL_TABLE_COUNT);
  });

  it("uses the table number as the display number for every entry", () => {
    for (const t of TABLE_CATALOG) {
      expect(t.number).toBe(t.id);
    }
  });
});

describe("isBeforeOpening", () => {
  it("returns true when current time is before opening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(true);
    vi.useRealTimers();
  });

  it("returns false when current time is after opening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(false);
    vi.useRealTimers();
  });

  it("returns true for the default opening datetime when well before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(isBeforeOpening(DEFAULT_OPENING_DATETIME)).toBe(true);
    vi.useRealTimers();
  });

  it("returns true 1 second before Copenhagen opening time (CEST boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T07:59:59Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(true);
    vi.useRealTimers();
  });

  it("returns false at Copenhagen opening time (CEST boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T08:00:00Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(false);
    vi.useRealTimers();
  });

  it("returns false 1 second after Copenhagen opening time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T08:00:01Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(false);
    vi.useRealTimers();
  });
});

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({ language: "en", ready: true, setLanguage: vi.fn(), t: (key: string) => key }),
}));
vi.mock("@/hooks/useHistoryState", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    useHistoryState: <T,>(_key: string, initial: T): [T, (v: T) => void] => {
      return react.useState<T>(initial);
    },
  };
});
vi.mock("@/components/LanguageSelector", () => ({
  LanguageSelector: () => <div data-testid="lang-selector" />,
}));
vi.mock("@/components/PreOpenPage", () => ({
  PreOpenPage: () => <div data-testid="pre-open-page" />,
}));
vi.mock("@/components/LandingPage", () => ({
  LandingPage: ({ onEnter }: { onEnter?: () => void }) => (
    <div data-testid="landing-page">
      {onEnter && (
        <button data-testid="enter-cta" onClick={onEnter}>Enter</button>
      )}
    </div>
  ),
}));
vi.mock("@/components/TableMapPage", () => ({
  TableMapPage: () => <div data-testid="table-map-page" />,
}));
vi.mock("@/components/WaitlistForm", () => ({
  WaitlistForm: () => <div data-testid="waitlist-form" />,
}));
vi.mock("@/components/AdminPage", () => ({
  AdminPage: () => <div data-testid="admin-page" />,
}));
vi.mock("@/components/LoadingSplash", () => ({
  LoadingSplash: () => <div data-testid="loading-splash" />,
}));

describe("Home page render gating", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows loading splash while status is being fetched (not pre-open page)", async () => {
    let resolveStatus!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      return new Promise((r) => { resolveStatus = r; });
    }));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("loading-splash")).toBeDefined();
    expect(screen.queryByTestId("pre-open-page")).toBeNull();
    expect(screen.queryByTestId("landing-page")).toBeNull();

    await act(async () => {
      resolveStatus(new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableTables: true }), { status: 200 }));
    });

    expect(screen.queryByTestId("loading-splash")).toBeNull();
    expect(screen.getByTestId("landing-page")).toBeDefined();
    expect(screen.queryByTestId("pre-open-page")).toBeNull();
  });

  it("shows landing page directly when status responds with isOpen: true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableTables: true }), { status: 200 }),
    ));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("landing-page")).toBeDefined();
    expect(screen.queryByTestId("pre-open-page")).toBeNull();
  });

  it("shows pre-open page when status responds with isOpen: false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isOpen: false, openingDatetime: "2026-04-01T10:00:00", hasAvailableTables: true }), { status: 200 }),
    ));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("pre-open-page")).toBeDefined();
    expect(screen.queryByTestId("landing-page")).toBeNull();
  });

  it("falls back to pre-open page when API fetch fails (no infinite spinner)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("pre-open-page")).toBeDefined();
    expect(screen.queryByTestId("loading-splash")).toBeNull();
  });

  it("routes into the registration flow when the landing CTA is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableTables: true }), { status: 200 }),
    ));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByTestId("landing-page")).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId("enter-cta"));
    });

    expect(screen.getByTestId("table-map-page")).toBeDefined();
    expect(screen.queryByTestId("landing-page")).toBeNull();
  });

  it("returns to landing page from the registration flow when header home button is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableTables: true }), { status: 200 }),
    ));

    const Home = (await import("./page")).default;

    await act(async () => {
      render(<Home />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("enter-cta"));
    });

    expect(screen.getByTestId("table-map-page")).toBeDefined();

    const homeButton = screen.getByLabelText("common.appName");
    await act(async () => {
      fireEvent.click(homeButton);
    });

    expect(screen.getByTestId("landing-page")).toBeDefined();
    expect(screen.queryByTestId("table-map-page")).toBeNull();
  });
});
