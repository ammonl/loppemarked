import { useLanguage } from "@/i18n/LanguageProvider";
import { EventContactLink } from "@/i18n/contactLink";
import { Un17Logo } from "@/components/Un17Logo";
import { colors, fonts } from "@/styles/theme";

// The shared UN17 About / Privacy / Terms documents live on the hub and cover
// every UN17 site. Each link carries the #loppemarked anchor so a reader lands
// on this app's section rather than the top of a seven-app document; un17hub's
// tests/check_doc_anchors.js keeps those anchors from disappearing.
const SHARED_DOCS = [
  {
    href: "https://un17hub.com/about/#loppemarked",
    labelKey: "about.sharedAbout",
  },
  {
    href: "https://un17hub.com/privacy/#loppemarked",
    labelKey: "about.sharedPrivacy",
  },
  {
    href: "https://un17hub.com/terms/#loppemarked",
    labelKey: "about.sharedTerms",
  },
] as const;

export function ProjectAbout() {
  const { t } = useLanguage();

  return (
    <footer
      id="about"
      style={{
        maxWidth: 800,
        margin: "2rem auto 0",
        padding: "1.5rem 1rem 2rem",
        textAlign: "center",
        scrollMarginTop: "5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          marginBottom: "1.25rem",
          color: colors.fleaTerracotta,
        }}
      >
        <div
          style={{
            flex: 1,
            maxWidth: 200,
            height: 1,
            background: `linear-gradient(to right, transparent, ${colors.fleaSand})`,
          }}
        />
        <span
          aria-hidden
          style={{
            fontFamily: fonts.display,
            fontSize: "1.75rem",
            lineHeight: 1,
          }}
        >
          ✦
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 200,
            height: 1,
            background: `linear-gradient(to left, transparent, ${colors.fleaSand})`,
          }}
        />
      </div>

      <h2
        style={{
          fontFamily: fonts.display,
          color: colors.fleaTerracottaDark,
          fontSize: "1.85rem",
          letterSpacing: "0.05em",
          margin: "0 0 0.5rem",
        }}
      >
        {t("about.title")}
      </h2>
      <p
        style={{
          fontFamily: fonts.sans,
          color: colors.fleaPenInk,
          fontSize: "0.9rem",
          lineHeight: 1.6,
          margin: "0 auto 0.9rem",
          maxWidth: 520,
        }}
      >
        {t("about.description")}
      </p>
      <p
        style={{
          fontFamily: fonts.sans,
          color: colors.fleaPenInk,
          fontSize: "0.85rem",
          margin: "0 0 0.25rem",
        }}
      >
        {t("about.contact")}
      </p>
      <p style={{ margin: 0, fontSize: "0.9rem", fontFamily: fonts.marker }}>
        <EventContactLink
          style={{
            color: colors.fleaSageDark,
            textDecoration: "none",
            fontWeight: 600,
          }}
        />
      </p>
      <p
        style={{
          margin: "0.9rem 0 0",
          fontSize: "0.85rem",
          fontFamily: fonts.sans,
        }}
      >
        {SHARED_DOCS.map((doc, i) => (
          <span key={doc.href}>
            {i > 0 && " · "}
            <a
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.fleaSageDark, textDecoration: "none" }}
            >
              {t(doc.labelKey)}
            </a>
          </span>
        ))}
      </p>
      <div
        aria-hidden
        style={{
          marginTop: "2rem",
          display: "flex",
          justifyContent: "center",
          transform: "rotate(-2.5deg)",
        }}
      >
        <Un17Logo variant="footer" />
      </div>
    </footer>
  );
}
