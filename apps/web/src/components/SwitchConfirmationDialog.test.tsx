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
        "registration.switchCurrentTable": "Your current table",
        "registration.switchNewTable": "New table",
        "registration.switchExplainer":
          "Each apartment may only book one table. If you continue, your current table will be released and you will be booked for the new table. This action cannot be undone.",
        "registration.switchKeep": "Keep current table",
        "registration.switchConfirm": "Confirm switch",
        "table.detailsTitle": "Table #{number}",
        "common.loading": "Loading...",
      };
      return translations[key] ?? key;
    },
  }),
}));

const defaultSwitchDetails: SwitchDetails = {
  existingTableId: 5,
  existingTableLabel: "Table #5",
  newTableId: 20,
  newTableLabel: "Table #20",
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
    expect(screen.getByTestId("current-table")).toBeDefined();
    expect(screen.getByTestId("new-table")).toBeDefined();
    expect(screen.getByText(/Table #5/)).toBeDefined();
    expect(screen.getByText(/Table #20/)).toBeDefined();
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

  it("shows table numbers and size in the display", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText(/Table #5.*75x150 cm/)).toBeDefined();
    expect(screen.getByText(/Table #20.*76x210 cm/)).toBeDefined();
  });

  it("does not show price/DKK in the display", () => {
    render(
      <SwitchConfirmationDialog
        switchDetails={defaultSwitchDetails}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByText(/DKK/)).toBeNull();
  });
});
