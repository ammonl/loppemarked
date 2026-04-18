import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwitchConfirmationDialog, type SwitchDetails } from "./SwitchConfirmationDialog";

vi.mock("@/i18n/LanguageProvider", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) => {
      const translations: Record<string, string> = {
        "registration.switchTitle": "Confirm table switch",
        "registration.switchCurrentBox": "Your current table",
        "registration.switchNewBox": "New table",
        "registration.switchExplainer":
          "Each apartment may only book one flea-market table. If you continue, your current table will be released and you will be booked for the new table. This action cannot be undone.",
        "registration.switchKeep": "Keep current table",
        "registration.switchConfirm": "Confirm switch",
        "table.detailsTitle": "Table #{number}",
        "table.meters": "meters",
        "table.priceSuffix": "DKK",
        "common.loading": "Loading...",
      };
      return translations[key] ?? key;
    },
  }),
}));

const defaultSwitchDetails: SwitchDetails = {
  existingBoxId: 5,
  existingBoxName: "Bed 5",
  existingGreenhouse: "Kronen",
  newBoxId: 20,
  newBoxName: "Bed 20",
  newGreenhouse: "Søen",
};

afterEach(cleanup);

describe("SwitchConfirmationDialog", () => {
  it("renders dialog with current and new table details by number", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Confirm table switch")).toBeDefined();
    expect(screen.getByTestId("current-box")).toBeDefined();
    expect(screen.getByTestId("new-box")).toBeDefined();
    expect(screen.getByText(/Table #5/)).toBeDefined();
    expect(screen.getByText(/Table #20/)).toBeDefined();
    // Greenhouse name/box name should not leak through any more.
    expect(screen.queryByText(/Kronen/)).toBeNull();
    expect(screen.queryByText(/Søen/)).toBeNull();
    expect(screen.queryByText(/Bed 5/)).toBeNull();
  });

  it("renders the explainer text", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText(/cannot be undone/)).toBeDefined();
  });

  it("has accessible alertdialog role", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeDefined();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByText("Keep current table"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByText("Confirm switch"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables buttons and shows loading text when confirming", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
        confirming={true}
      />,
    );

    expect(screen.getByText("Loading...")).toBeDefined();

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("shows table numbers and size/price in the display", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    // Table 5 is a standard 2m/50 DKK table in TABLE_CATALOG.
    expect(screen.getByText(/Table #5.*2 meters.*50 DKK/)).toBeDefined();
    // Table 20 is also a standard 2m/50 DKK table.
    expect(screen.getByText(/Table #20.*2 meters.*50 DKK/)).toBeDefined();
  });
});
