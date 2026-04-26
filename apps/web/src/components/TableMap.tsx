"use client";

import type { ClothingRackSide, TablePublic, TableCatalogEntry } from "@loppemarked/shared";
import {
  TABLE_CATALOG,
  TABLE_MAP_VIEWBOX,
  getClothingRackSide,
  getTableById,
  tableHasClothingRack,
} from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";

export type TableMapState = "ledigt" | "reserveret" | "valgt";

const STATE_COLORS: Record<TableMapState, { fill: string; stroke: string; text: string }> = {
  ledigt: { fill: colors.fleaSage, stroke: colors.fleaSageDark, text: colors.fleaCream },
  reserveret: { fill: colors.fleaTerracotta, stroke: colors.fleaTerracottaDark, text: colors.fleaCream },
  // Selected switches to brass so the chosen tile is unmistakable next to
  // both the sage available state and the terracotta booked state.
  valgt: { fill: colors.fleaBrass, stroke: colors.fleaBrassDark, text: colors.fleaCream },
};

const FLOOR_PLAN_INSET_X = 4;
const FLOOR_PLAN_INSET_TOP = 8;
const FLOOR_PLAN_INSET_BOTTOM = 8;

// The entrance label sits horizontally between tables 20 and 24, the two
// rightmost columns adjacent to the venue door. Derived from the catalog so
// the label tracks any future moves of those tables.
const ENTRANCE_LABEL_X = (() => {
  const t20 = getTableById(20);
  const t24 = getTableById(24);
  if (!t20 || !t24) return 90.05;
  return (t20.x + t20.width / 2 + (t24.x + t24.width / 2)) / 2;
})();

/**
 * Returns the rectangle for a clothing rack drawn on the side of the table
 * indicated by the published map reference.
 */
function clothingRackRect(table: TableCatalogEntry, side: ClothingRackSide) {
  const RACK_DEPTH = 2;
  const RACK_GAP = 0.4;
  switch (side) {
    case "above":
      return {
        x: table.x,
        y: table.y - RACK_DEPTH - RACK_GAP,
        width: table.width,
        height: RACK_DEPTH,
      };
    case "below":
      return {
        x: table.x,
        y: table.y + table.height + RACK_GAP,
        width: table.width,
        height: RACK_DEPTH,
      };
    case "left":
      return {
        x: table.x - RACK_DEPTH - RACK_GAP,
        y: table.y,
        width: RACK_DEPTH,
        height: table.height,
      };
    case "right":
      return {
        x: table.x + table.width + RACK_GAP,
        y: table.y,
        width: RACK_DEPTH,
        height: table.height,
      };
  }
}

function ClothingRackGlyph({ table, side }: { table: TableCatalogEntry; side: ClothingRackSide }) {
  const rect = clothingRackRect(table, side);
  const isHorizontal = rect.width > rect.height;
  // Rod runs along the long axis of the rack.
  const rodInset = 0.3;
  const rod = isHorizontal
    ? { x1: rect.x + rodInset, y1: rect.y + rect.height / 2, x2: rect.x + rect.width - rodInset, y2: rect.y + rect.height / 2 }
    : { x1: rect.x + rect.width / 2, y1: rect.y + rodInset, x2: rect.x + rect.width / 2, y2: rect.y + rect.height - rodInset };
  return (
    <g aria-hidden style={{ pointerEvents: "none" }}>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={0.4}
        fill={colors.fleaBrass}
        stroke={colors.fleaBrassDark}
        strokeWidth={0.4}
        opacity={0.9}
      />
      <line
        x1={rod.x1}
        y1={rod.y1}
        x2={rod.x2}
        y2={rod.y2}
        stroke={colors.fleaCream}
        strokeWidth={0.3}
        strokeLinecap="round"
      />
    </g>
  );
}

interface TableMapProps {
  tablesById: Map<number, TablePublic>;
  selectedId: number | null;
  onSelect: (table: TableCatalogEntry) => void;
}

export function TableMap({ tablesById, selectedId, onSelect }: TableMapProps) {
  const { t } = useLanguage();
  const { width, height } = TABLE_MAP_VIEWBOX;

  return (
    <div role="img" aria-label={t("table.mapAriaLabel")} className="flea-map__frame">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          <pattern id="fleaFloor" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={colors.fleaPaperAged} />
            <path d="M0 6 L6 0" stroke={colors.fleaPaperAgedShade} strokeWidth="0.5" opacity="0.5" />
          </pattern>
          <radialGradient id="fleaFloorVignette" cx="50%" cy="40%" r="70%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(110, 55, 32, 0.22)" />
          </radialGradient>
        </defs>

        {(() => {
          const planX = FLOOR_PLAN_INSET_X;
          const planY = FLOOR_PLAN_INSET_TOP;
          const planW = width - FLOOR_PLAN_INSET_X * 2;
          const planH = height - FLOOR_PLAN_INSET_TOP - FLOOR_PLAN_INSET_BOTTOM;
          return (
            <>
              <rect x={planX} y={planY} width={planW} height={planH} rx={3} fill="url(#fleaFloor)" />
              <rect x={planX} y={planY} width={planW} height={planH} rx={3} fill="url(#fleaFloorVignette)" />
              <rect
                x={planX}
                y={planY}
                width={planW}
                height={planH}
                rx={3}
                fill="none"
                stroke={colors.fleaCorkFrame}
                strokeWidth={0.9}
                strokeDasharray="0.8 1.2"
                opacity={0.7}
              />
            </>
          );
        })()}

        <text
          x={width / 2}
          y={5}
          fontSize={4}
          fontWeight={700}
          textAnchor="middle"
          fill={colors.fleaAccentInk}
          fontFamily="'Caveat', cursive"
        >
          {t("table.floorPlanCourtyard")}
        </text>

        <text
          x={width / 2}
          y={height - 2}
          fontSize={4}
          fontWeight={700}
          textAnchor="middle"
          fill={colors.fleaAccentInk}
          fontFamily="'Caveat', cursive"
        >
          {t("table.floorPlanPromenade")}
        </text>

        <text
          x={ENTRANCE_LABEL_X}
          y={height - 11}
          fontSize={3.2}
          fontWeight={700}
          textAnchor="middle"
          fill={colors.fleaAccentInk}
          fontFamily="'Caveat', cursive"
        >
          {t("table.floorPlanEntrance")}
        </text>

        {TABLE_CATALOG.map((table) => {
          const entry = tablesById.get(table.id);
          const isSelected = selectedId === table.id;
          const publicState = entry?.state ?? "occupied";
          const mapState: TableMapState = isSelected
            ? "valgt"
            : publicState === "available"
            ? "ledigt"
            : "reserveret";
          const palette = STATE_COLORS[mapState];
          const cx = table.x + table.width / 2;
          const cy = table.y + table.height / 2;
          const hasRack = tableHasClothingRack(table.id);
          const rackSide = getClothingRackSide(table.id);

          return (
            <g
              key={table.id}
              data-testid={`table-tile-${table.number}`}
              onClick={() => onSelect(table)}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={t("table.ariaTile")
                .replace("{number}", String(table.number))
                .replace("{state}", t(`table.state.${mapState}`))}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(table);
                }
              }}
            >
              {isSelected && (
                <rect
                  x={table.x - 1.4}
                  y={table.y - 1.4}
                  width={table.width + 2.8}
                  height={table.height + 2.8}
                  rx={2}
                  fill={colors.fleaBrass}
                  opacity={0.35}
                />
              )}
              {hasRack && rackSide && <ClothingRackGlyph table={table} side={rackSide} />}
              <rect
                x={table.x}
                y={table.y}
                width={table.width}
                height={table.height}
                rx={0.9}
                fill={palette.fill}
                stroke={palette.stroke}
                strokeWidth={isSelected ? 0.9 : 0.5}
              />
              <text
                x={cx}
                y={cy + 1.2}
                fontSize={3.2}
                fontWeight={700}
                textAnchor="middle"
                fill={palette.text}
                style={{ pointerEvents: "none", userSelect: "none" }}
                fontFamily="'Inter', system-ui, sans-serif"
              >
                {table.number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TableStateLegend() {
  const { t } = useLanguage();
  const items: TableMapState[] = ["ledigt", "reserveret", "valgt"];
  return (
    <div
      role="list"
      aria-label={t("map.legend")}
      style={{
        display: "flex",
        gap: "1.25rem",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {items.map((state) => {
        const palette = STATE_COLORS[state];
        return (
          <div
            key={state}
            role="listitem"
            style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 12,
                borderRadius: 3,
                background: palette.fill,
                border: `1.5px solid ${palette.stroke}`,
                boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.3)",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: colors.fleaInkSoft }}>
              {t(`table.state.${state}`)}
            </span>
          </div>
        );
      })}
      <div role="listitem" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-block",
            width: 18,
            height: 12,
            borderRadius: 3,
            background: colors.fleaBrass,
            border: `1.5px solid ${colors.fleaBrassDark}`,
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.3)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 5,
              left: 2,
              right: 2,
              height: 1,
              background: colors.fleaCream,
              borderRadius: 1,
            }}
          />
        </span>
        <span style={{ fontSize: "0.85rem", color: colors.fleaInkSoft }}>
          {t("table.legendClothingRack")}
        </span>
      </div>
    </div>
  );
}
