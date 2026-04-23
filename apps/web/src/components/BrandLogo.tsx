"use client";

import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/styles/theme";
import { onBookingSuccess } from "@/utils/brandEvents";
import "@/styles/brandLogo.css";

type LogoVariant = "header" | "footer" | "mark";

interface BrandLogoProps {
  variant?: LogoVariant;
  /** Color override for the wordmark + doodle strokes. */
  color?: string;
  /** Optional title announced to assistive tech. Ignored when `decorative`. */
  title?: string;
  /** If true, subscribes to the global booking-success event and wiggles. */
  reactToBookingSuccess?: boolean;
  /** When true, the logo is hidden from assistive tech (use when the parent labels itself). */
  decorative?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Custom hand-crafted UN17 Village brand mark. Wordmark uses the loaded
 * Caveat signature font with per-letter wobble, paired with a heart + leaf
 * doodle drawn as SVG paths so it also works as a favicon.
 */
export function BrandLogo({
  variant = "header",
  color,
  title = "UN17 Village",
  reactToBookingSuccess,
  decorative,
  style,
  className,
}: BrandLogoProps) {
  const [wiggle, setWiggle] = useState(false);
  const wiggleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!reactToBookingSuccess) return;
    const unsubscribe = onBookingSuccess(() => {
      if (wiggleTimerRef.current !== null) {
        window.clearTimeout(wiggleTimerRef.current);
      }
      setWiggle(false);
      requestAnimationFrame(() => setWiggle(true));
      wiggleTimerRef.current = window.setTimeout(() => {
        setWiggle(false);
        wiggleTimerRef.current = null;
      }, 1400);
    });
    return () => {
      unsubscribe();
      if (wiggleTimerRef.current !== null) {
        window.clearTimeout(wiggleTimerRef.current);
        wiggleTimerRef.current = null;
      }
    };
  }, [reactToBookingSuccess]);

  if (variant === "mark") {
    return (
      <HeartLeafDoodle
        color={color ?? colors.fleaSage}
        title={title}
        className={className}
        style={style}
        wiggle={wiggle}
        decorative={decorative}
      />
    );
  }

  const isFooter = variant === "footer";
  const resolvedColor = color ?? (isFooter ? colors.fleaTerracotta : colors.fleaSage);
  const softShadow = isFooter ? "rgba(168, 85, 68, 0.12)" : "rgba(111, 138, 111, 0.14)";
  const ariaProps = decorative
    ? ({ "aria-hidden": true as const } as const)
    : ({ role: "img" as const, "aria-label": title } as const);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isFooter ? "0.4rem" : "0.55rem",
        color: resolvedColor,
        lineHeight: 1,
        filter: isFooter ? "saturate(0.85)" : undefined,
        opacity: isFooter ? 0.8 : 1,
        ...style,
      }}
      {...ariaProps}
    >
      <HeartLeafDoodle
        color={resolvedColor}
        title={title}
        wiggle={wiggle}
        style={{ flex: "0 0 auto" }}
        size={isFooter ? 26 : 32}
        decorative
      />
      <svg
        viewBox="0 0 200 56"
        width={isFooter ? 132 : 170}
        height={isFooter ? 36 : 46}
        role="presentation"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id={`un17-soft-${variant}`} x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        </defs>
        {/* Faint stamped shadow for hand-pressed feel */}
        <g
          fill={softShadow}
          fontFamily={fonts.display}
          fontWeight={700}
          fontSize="44"
          letterSpacing="1"
          filter={`url(#un17-soft-${variant})`}
          aria-hidden
        >
          <text x="1" y="39">UN17</text>
        </g>
        {/* Wordmark: UN17 + Village in two weights/faces for signature feel */}
        <g fill={resolvedColor} aria-hidden>
          <text
            x="0"
            y="38"
            fontFamily={fonts.display}
            fontWeight={700}
            fontSize="44"
            letterSpacing="1.4"
          >
            <tspan dy="0">U</tspan>
            <tspan dy="-1">N</tspan>
            <tspan dy="2">1</tspan>
            <tspan dy="-1">7</tspan>
          </text>
          <text
            x="92"
            y="40"
            fontFamily={fonts.marker}
            fontWeight={600}
            fontSize="32"
            fontStyle="italic"
          >
            <tspan dy="0">V</tspan>
            <tspan dy="-1">i</tspan>
            <tspan dy="1">l</tspan>
            <tspan dy="-1">l</tspan>
            <tspan dy="1">a</tspan>
            <tspan dy="0">g</tspan>
            <tspan dy="-1">e</tspan>
          </text>
          {/* Hand-drawn underline swoosh under Village */}
          <path
            d="M92 46 q18 4 36 1 q14 -2 30 1"
            stroke={resolvedColor}
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity={0.75}
          />
        </g>
      </svg>
    </span>
  );
}

interface HeartLeafDoodleProps {
  color: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  wiggle?: boolean;
  decorative?: boolean;
}

/**
 * Hand-drawn heart crossed with a small botanical leaf. Also used as the
 * simplified favicon variant.
 */
function HeartLeafDoodle({
  color,
  title,
  className,
  style,
  size = 32,
  wiggle,
  decorative,
}: HeartLeafDoodleProps) {
  const classes = [className, "un17-doodle", wiggle ? "un17-doodle--wiggle" : null]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      data-un17-doodle="true"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={classes}
      style={style}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      {!decorative && title ? <title>{title}</title> : null}
      <g
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Heart body with a slight wobble on the right curve */}
        <path
          d="M16 27.2
             C 12 24  6.8 20.4  6.8 14.8
             C 6.8 11.6  9.3  9.2 12.2  9.2
             C 14.2  9.2 15.4 10.3 16 11.6
             C 16.6 10.2 17.9  9   20  9
             C 22.9  9  25.4 11.5 25.4 14.6
             C 25.4 20.2 20 24.2 16 27.2 Z"
          fill={color}
          fillOpacity={0.18}
        />
        {/* Botanical stem tucked behind the heart */}
        <path d="M16 11.4 C 16.4 8.2 17.8 5.8 20.2 4.4" />
        {/* Two little leaves on the stem */}
        <path d="M17.4 7.6 C 19 6.8 20.6 7.2 21.4 8.2 C 20.3 9.1 18.6 9 17.4 7.6 Z" fill={color} fillOpacity={0.25} />
        <path d="M16.6 9.8 C 15.2 9.2 13.9 9.6 13.2 10.5 C 14.1 11.4 15.6 11.2 16.6 9.8 Z" fill={color} fillOpacity={0.25} />
        {/* Tiny stitched highlight inside the heart */}
        <path d="M11.2 14.2 C 12 13.4 12.9 13 13.9 13.2" strokeWidth="1.1" opacity={0.75} />
      </g>
    </svg>
  );
}
