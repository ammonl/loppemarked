import type { CSSProperties } from "react";

export const colors = {
  backgroundLight: "#F5F4F0",
  cream: "#FAF6F0",
  parchment: "#F0EBE1",
  sage: "#7A8B6F",
  sageDark: "#5C6B52",
  terracotta: "#C67D4B",
  terracottaDark: "#A8623A",
  warmBrown: "#6B5243",
  inkBrown: "#4A3728",
  mutedGold: "#B8A361",
  dustyRose: "#C9908A",
  skyMist: "#A8C4C2",
  borderTan: "#D4C9B8",
  white: "#FFFFFF",
  parchmentDark: "#E5DFD3",
  lightSage: "#EAF0E5",
  errorBg: "#FAF0EE",
  errorText: "#8B4A42",
  infoBg: "#EEF4F4",
  infoText: "#4A7572",
  warningBg: "#FCF8EE",
  warningText: "#7A6A30",
  overlayWhite: "rgba(255, 255, 255, 0.92)",
  overlayBorder: "rgba(200, 200, 195, 0.4)",

  fleaTerracotta: "#C6705D",
  fleaTerracottaDark: "#A85544",
  fleaSand: "#E5D3B3",
  fleaSandLight: "#F0E3C9",
  fleaSage: "#8DA88D",
  fleaSageDark: "#6F8A6F",
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
};

export const fonts = {
  heading: "'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  display: "'Amatic SC', 'Caveat', cursive",
  marker: "'Caveat', 'Amatic SC', cursive",
  sans: "'Montserrat', 'Inter', system-ui, sans-serif",
};

export const shadows = {
  card: "0 2px 8px rgba(74, 55, 40, 0.08)",
  cardHover: "0 4px 16px rgba(74, 55, 40, 0.14)",
  soft: "0 1px 4px rgba(74, 55, 40, 0.06)",
  overlay: "0 1px 8px rgba(0, 0, 0, 0.06)",
};

export const containerStyle: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "2rem 1rem",
};

export const cardStyle: CSSProperties = {
  background: colors.parchment,
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
  background: colors.parchment,
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 10,
  padding: "1.25rem",
};

export const dialogStyle: CSSProperties = {
  border: `1px solid ${colors.borderTan}`,
  borderRadius: 10,
  padding: "1.5rem",
  background: colors.white,
  boxShadow: "0 4px 20px rgba(74, 55, 40, 0.12)",
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
