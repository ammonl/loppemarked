import type { CSSProperties } from "react";

// Legacy semantic tokens. These are re-bound to the material brand palette
// (defined in the `flea*` block below) so admin and other surfaces that still
// reference role-based names re-theme consistently with the redesigned public
// site without per-component churn. New code should prefer the `flea*` tokens
// directly.
export const colors = {
  backgroundLight: "#FDFBF7",
  cream: "#FDFBF7",
  parchment: "#F0E3C9",
  sage: "#8DA88D",
  sageDark: "#6F8A6F",
  terracotta: "#C6705D",
  terracottaDark: "#A85544",
  warmBrown: "#5B4636",
  inkBrown: "#2E1F14",
  mutedGold: "#B88A3A",
  dustyRose: "#B8736A",
  skyMist: "#B8C7B8",
  borderTan: "#E5D3B3",
  white: "#FFFFFF",
  parchmentDark: "#E9D3AE",
  lightSage: "#EAF0E5",
  errorBg: "#F8E2DC",
  errorText: "#762C21",
  infoBg: "#EAEFE7",
  infoText: "#4A6450",
  warningBg: "#F4E8D4",
  warningText: "#8A6528",
  overlayWhite: "rgba(253, 251, 247, 0.94)",
  overlayBorder: "rgba(110, 82, 48, 0.18)",

  fleaTerracotta: "#C6705D",
  fleaTerracottaDark: "#A85544",
  fleaSand: "#E5D3B3",
  fleaSandLight: "#F0E3C9",
  fleaSage: "#8DA88D",
  fleaSageDark: "#6F8A6F",
  fleaGreenDark: "#2F4A35",
  fleaGreenDarker: "#23372A",
  fleaGreenDivider: "rgba(253, 251, 247, 0.18)",
  fleaCream: "#FDFBF7",
  fleaCork: "#C89F76",
  fleaCorkDark: "#A07A55",
  fleaCorkFrame: "#8A5F3E",
  fleaCorkFrameDark: "#6A4626",
  fleaNotePaper: "#FBF4E1",
  fleaNotePaperWarm: "#F4E8D4",
  fleaNotePaperLight: "#F7EEDD",
  fleaFloorShadow: "#D7B98E",
  fleaPinLight: "#E46E52",
  fleaPinDark: "#8A3A26",
  fleaPenInk: "#5B4636",

  // Material palette for the scene-based landing redesign. Names are kept
  // surface/role-based rather than page-specific so the map and admin pages
  // can reuse the same tokens.
  fleaInk: "#2E1F14",
  fleaInkSoft: "#4A382A",
  fleaPaperAged: "#F5E6CB",
  fleaPaperAgedShade: "#E9D3AE",
  fleaPaperEdge: "rgba(120, 82, 48, 0.35)",
  // Accent palette: the "accent" role is bound to fleaTerracottaDark so
  // there's a single hex literal for the primary accent. fleaAccentInk /
  // Glow / Pressed / Edge are distinct shades used alongside it.
  fleaAccentInk: "#762C21",
  fleaAccentGlow: "#D8826E",
  fleaAccentPressed: "#924736",
  fleaAccentEdge: "#6E2318",
  fleaForestDeep: "#1C2E21",
  fleaWoodFloor: "#A8784F",
  fleaWoodFloorDeep: "#6B4A33",
  fleaWoodFloorLow: "#3B2A1E",
  fleaWoodFloorWarm: "#E0BE89",
  fleaBrass: "#B88A3A",
  fleaBrassDark: "#8A6528",
  fleaSceneLightWarm: "rgba(255, 235, 195, 0.55)",
  fleaShadowWarm: "rgba(110, 55, 32, 0.45)",
  fleaShadowDeep: "rgba(18, 12, 6, 0.5)",
  fleaShadowContact: "rgba(0, 0, 0, 0.3)",
};

export const fonts = {
  heading: "'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  display: "'Amatic SC', 'Caveat', cursive",
  marker: "'Caveat', 'Amatic SC', cursive",
  sans: "'Montserrat', 'Inter', system-ui, sans-serif",
};

export const shadows = {
  card: "0 2px 8px rgba(46, 31, 20, 0.08)",
  cardHover: "0 4px 16px rgba(46, 31, 20, 0.14)",
  soft: "0 1px 4px rgba(46, 31, 20, 0.06)",
  overlay: "0 1px 8px rgba(46, 31, 20, 0.06)",
  // Warm material shadows tuned for the scene-based landing redesign. Kept as
  // separate layers so callers can compose drop + ambient cast as needed.
  warmDrop: "0 18px 28px -10px rgba(110, 55, 32, 0.45)",
  warmCast: "0 44px 70px -22px rgba(18, 12, 6, 0.5)",
  warmContact: "0 1px 2px rgba(0, 0, 0, 0.1)",
};

export const containerStyle: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "2rem 1rem",
};

export const cardStyle: CSSProperties = {
  background: colors.cream,
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 10,
  padding: "1.5rem",
  boxShadow: shadows.card,
};

export const headingStyle: CSSProperties = {
  fontFamily: fonts.heading,
  color: colors.warmBrown,
  fontWeight: 700,
  margin: 0,
};

export const bodyTextStyle: CSSProperties = {
  fontFamily: fonts.body,
  color: colors.inkBrown,
  lineHeight: 1.6,
};

export const labelStyle: CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  color: colors.warmBrown,
  fontFamily: fonts.body,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 6,
  fontSize: "0.95rem",
  fontFamily: fonts.body,
  color: colors.inkBrown,
  background: colors.white,
  outline: "none",
  boxSizing: "border-box",
};

export const buttonPrimary: CSSProperties = {
  padding: "0.5rem 1.25rem",
  background: colors.sage,
  color: colors.white,
  border: "none",
  borderRadius: 6,
  fontSize: "0.9rem",
  fontWeight: 600,
  fontFamily: fonts.body,
  cursor: "pointer",
};

export const buttonSecondary: CSSProperties = {
  padding: "0.5rem 1.25rem",
  background: colors.white,
  color: colors.warmBrown,
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 6,
  fontSize: "0.9rem",
  fontWeight: 500,
  fontFamily: fonts.body,
  cursor: "pointer",
};

export const buttonDanger: CSSProperties = {
  padding: "0.5rem 1.25rem",
  background: colors.white,
  color: colors.dustyRose,
  border: `1px solid ${colors.dustyRose}`,
  borderRadius: 6,
  fontSize: "0.9rem",
  fontWeight: 500,
  fontFamily: fonts.body,
  cursor: "pointer",
};

export const buttonTerracotta: CSSProperties = {
  padding: "0.5rem 1.25rem",
  background: colors.terracotta,
  color: colors.white,
  border: "none",
  borderRadius: 6,
  fontSize: "0.9rem",
  fontWeight: 600,
  fontFamily: fonts.body,
  cursor: "pointer",
};

export const alertSuccess: CSSProperties = {
  background: colors.lightSage,
  border: `1px solid ${colors.sage}`,
  color: colors.sageDark,
  borderRadius: 6,
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  fontFamily: fonts.body,
};

export const alertError: CSSProperties = {
  background: colors.errorBg,
  border: `1px solid ${colors.dustyRose}`,
  color: colors.errorText,
  borderRadius: 6,
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  fontFamily: fonts.body,
};

export const alertInfo: CSSProperties = {
  background: colors.infoBg,
  border: `1px solid ${colors.skyMist}`,
  color: colors.infoText,
  borderRadius: 6,
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  fontFamily: fonts.body,
};

export const alertWarning: CSSProperties = {
  background: colors.warningBg,
  border: `1px solid ${colors.mutedGold}`,
  color: colors.warningText,
  borderRadius: 6,
  padding: "0.75rem 1rem",
  fontSize: "0.9rem",
  fontFamily: fonts.body,
};

export const sectionStyle: CSSProperties = {
  background: colors.cream,
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 10,
  padding: "1.25rem",
};

export const dialogStyle: CSSProperties = {
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 10,
  padding: "1.5rem",
  background: colors.cream,
  boxShadow: "0 4px 20px rgba(46, 31, 20, 0.14)",
};

export const tableHeaderStyle: CSSProperties = {
  borderBottom: `2px solid ${colors.borderTan}`,
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  fontFamily: fonts.body,
  fontWeight: 600,
  fontSize: "0.85rem",
  color: colors.warmBrown,
};

export const tableRowStyle: CSSProperties = {
  borderBottom: `1px solid ${colors.parchment}`,
};

export const tableCellStyle: CSSProperties = {
  padding: "0.5rem 0.75rem",
  fontSize: "0.85rem",
  fontFamily: fonts.body,
  color: colors.inkBrown,
};

export const linkStyle: CSSProperties = {
  color: colors.sage,
  textDecoration: "none",
  cursor: "pointer",
  fontFamily: fonts.body,
};

export const pageBackground: CSSProperties = {
  background: colors.cream,
  minHeight: "100vh",
  fontFamily: fonts.body,
  color: colors.inkBrown,
};

export const tabStyle: CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "0.6rem 1.25rem",
  fontSize: "0.9rem",
  fontFamily: fonts.body,
  color: colors.warmBrown,
  cursor: "pointer",
};

export const tabActiveStyle: CSSProperties = {
  ...tabStyle,
  borderBottom: `2px solid ${colors.sage}`,
  color: colors.sageDark,
  fontWeight: 600,
};

export const badgeStyle = (bg: string, text: string, border: string): CSSProperties => ({
  display: "inline-block",
  borderRadius: 12,
  padding: "0.15rem 0.6rem",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  background: bg,
  color: text,
  border: `1px solid ${border}`,
  fontFamily: fonts.body,
});
