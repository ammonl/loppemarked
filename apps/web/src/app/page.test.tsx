import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import {
  GREENHOUSES,
  DEFAULT_OPENING_DATETIME,
  OPENING_TIMEZONE,
  LANGUAGES,
  LANGUAGE_LABELS,
  ORGANIZER_CONTACTS,
  BOX_CATALOG,
  BOX_STATES,
} from "@loppemarked/shared";
import { translations, type TranslationKey } from "@/i18n/translations";
import { isBeforeOpening } from "@/utils/opening";

describe("shared package integration", () => {
  it("exports greenhouses", () => {
    expect(GREENHOUSES.length).toBeGreaterThan(0);
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
      "audit.detail.box",
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
      "registration.boxLabel",
      "registration.switchWarning",
      "registration.switchConfirm",
      "registration.switchTitle",
      "registration.switchCurrentBox",
      "registration.switchNewBox",
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
      "validation.boxIdInvalid",
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
      "admin.tab.boxes",
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

describe("greenhouse data", () => {
  it("has boxes for each greenhouse", () => {
    for (const gh of GREENHOUSES) {
      const boxes = BOX_CATALOG.filter((b) => b.greenhouse === gh);
      expect(boxes.length).toBeGreaterThan(0);
    }
  });

  it("Kronen has 14 boxes and Søen has 15 boxes", () => {
    const kronen = BOX_CATALOG.filter((b) => b.greenhouse === "Kronen");
    const soen = BOX_CATALOG.filter((b) => b.greenhouse === "Søen");
    expect(kronen.length).toBe(14);
    expect(soen.length).toBe(15);
  });

  it("uses global numbering 1-29", () => {
    const ids = BOX_CATALOG.map((b) => b.id);
    expect(ids).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
  });

  it("Kronen boxes are 1-14 and Søen boxes are 15-29", () => {
    const kronen = BOX_CATALOG.filter((b) => b.greenhouse === "Kronen");
    const soen = BOX_CATALOG.filter((b) => b.greenhouse === "Søen");
    expect(kronen.map((b) => b.id)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(soen.map((b) => b.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 15));
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
    // Opening at 10:00 Copenhagen (CEST = UTC+2) = 08:00 UTC
    // 1 second before: 07:59:59 UTC
    vi.setSystemTime(new Date("2026-04-01T07:59:59Z"));
    expect(isBeforeOpening("2026-04-01T10:00:00")).toBe(true);
    vi.useRealTimers();
  });

  it("returns false at Copenhagen opening time (CEST boundary)", () => {
    vi.useFakeTimers();
    // Opening at 10:00 Copenhagen (CEST = UTC+2) = 08:00 UTC
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
      resolveStatus(new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableBoxes: true }), { status: 200 }));
    });

    expect(screen.queryByTestId("loading-splash")).toBeNull();
    expect(screen.getByTestId("landing-page")).toBeDefined();
    expect(screen.queryByTestId("pre-open-page")).toBeNull();
  });

  it("shows landing page directly when status responds with isOpen: true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableBoxes: true }), { status: 200 }),
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
      new Response(JSON.stringify({ isOpen: false, openingDatetime: "2026-04-01T10:00:00", hasAvailableBoxes: true }), { status: 200 }),
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
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableBoxes: true }), { status: 200 }),
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
      new Response(JSON.stringify({ isOpen: true, openingDatetime: "2026-04-01T10:00:00", hasAvailableBoxes: true }), { status: 200 }),
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
