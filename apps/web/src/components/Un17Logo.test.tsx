import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Un17Logo } from "./Un17Logo";

describe("Un17Logo", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the shared <un17-logo> element forwarding variant and ARIA props", () => {
    const { container } = render(<Un17Logo variant="header" aria-hidden="true" />);
    const logo = container.querySelector("un17-logo");
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute("variant")).toBe("header");
    // Passed as the string "true" (not the boolean shorthand): React renders a
    // boolean aria-hidden on a custom element as aria-hidden="", which does not
    // reliably prune the element from assistive tech.
    expect(logo?.getAttribute("aria-hidden")).toBe("true");
  });

  it("reserves the variant footprint so the logo does not shift in on upgrade", () => {
    const { container } = render(<Un17Logo variant="footer" />);
    const logo = container.querySelector<HTMLElement>("un17-logo");
    expect(logo?.getAttribute("variant")).toBe("footer");
    expect(logo?.style.minWidth).toBe("164px");
    expect(logo?.style.minHeight).toBe("36px");
  });

  it("renders on the server without importing the browser-only package", () => {
    // renderToString never runs effects, so the deferred `import("@un17/logo")`
    // (which touches HTMLElement/customElements) is not triggered. This guards
    // against the browser-only registration being hoisted to a static import.
    const markup = renderToString(<Un17Logo variant="header" aria-hidden />);
    expect(markup).toContain("<un17-logo");
    expect(markup).toContain('variant="header"');
  });
});
