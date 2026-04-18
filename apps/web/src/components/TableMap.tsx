"use client";

import type { PlanterBoxPublic, TableCatalogEntry } from "@loppemarked/shared";
import { TABLE_CATALOG, TABLE_MAP_VIEWBOX } from "@loppemarked/shared";
import { useLanguage } from "@/i18n/LanguageProvider";
import { colors } from "@/styles/theme";

export type TableMapState = "ledigt" | "reserveret" | "valgt";

const STATE_COLORS: Record<TableMapState, { fill: string; stroke: string; text: string }> = {
  ledigt: { fill: colors.fleaSage, stroke: colors.fleaSageDark, text: colors.fleaCream },
  reserveret: { fill: colors.fleaTerracotta, stroke: colors.fleaTerracottaDark, text: colors.fleaCream },
  valgt: { fill: colors.fleaSage, stroke: "#D9B44A", text: colors.fleaCream },
};

interface TableMapProps {
  boxesById: Map<number, PlanterBoxPublic>;
  selectedId: number | null;
  onSelect: (table: TableCatalogEntry) => void;
}

export function TableMap({ boxesById, selectedId, onSelect }: TableMapProps) {
  const { t } = useLanguage();
  const { width, height } = TABLE_MAP_VIEWBOX;

  return (
    <div
      role="img"
      aria-label={t("table.mapAriaLabel")}
      style={{
        background: colors.fleaSandLight,
        border: `2px solid ${colors.fleaCork}`,
        borderRadius: 14,
        padding: "0.75rem",
        boxShadow: "inset 0 0 0 4px rgba(198, 159, 118, 0.25)",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <defs>
          <pattern id="fleaFloor" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={colors.fleaSandLight} />
            <path d="M0 6 L6 0" stroke={colors.fleaSand} strokeWidth="0.6" opacity="0.6" />
          </pattern>
        </defs>

        <rect x={4} y={4} width={width - 8} height={height - 8} rx={3} fill="url(#fleaFloor)" />
        <rect
          x={4}
          y={4}
          width={width - 8}
          height={height - 8}
          rx={3}
          fill="none"
          stroke={colors.fleaCorkFrame}
          strokeWidth={1.2}
        />

        <rect
          x={width / 2 - 7}
          y={height - 5}
          width={14}
          height={3}
          fill={colors.fleaCream}
          stroke={colors.fleaCorkFrame}
          strokeWidth={0.6}
        />
        <text
          x={width / 2}
          y={height - 2.4}
          fontSize={2.4}
          textAnchor="middle"
          fill={colors.fleaPenInk}
          fontFamily="'Caveat', cursive"
        >
          {t("table.floorPlanEntrance")}
        </text>

        <rect
          x={width / 2 - 10}
          y={5.5}
          width={20}
          height={3}
          fill={colors.fleaCorkDark}
          opacity={0.35}
          rx={0.6}
        />
        <text
          x={width / 2}
          y={7.8}
          fontSize={2.4}
          textAnchor="middle"
          fill={colors.fleaPenInk}
          fontFamily="'Caveat', cursive"
        >
          {t("table.floorPlanStage")}
        </text>

        {TABLE_CATALOG.map((table) => {
          const box = boxesById.get(table.id);
          const isSelected = selectedId === table.id;
          const publicState = box?.state ?? "occupied";
          const mapState: TableMapState = isSelected
            ? "valgt"
            : publicState === "available"
            ? "ledigt"
            : "reserveret";
          const palette = STATE_COLORS[mapState];
          const isClickable = publicState === "available";
          const cx = table.x + table.width / 2;
          const cy = table.y + table.height / 2;

          return (
            <g
              key={table.id}
              data-testid={`table-tile-${table.number}`}
              onClick={isClickable ? () => onSelect(table) : undefined}
              style={{ cursor: isClickable ? "pointer" : "not-allowed" }}
              role="button"
              aria-disabled={!isClickable}
              aria-label={t("table.ariaTile")
                .replace("{number}", String(table.number))
                .replace("{state}", t(`table.state.${mapState}`))}
              tabIndex={isClickable ? 0 : -1}
              onKeyDown={(e) => {
                if (!isClickable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(table);
                }
              }}
            >
              {isSelected && (
                <rect
                  x={table.x - 1.2}
                  y={table.y - 1.2}
                  width={table.width + 2.4}
                  height={table.height + 2.4}
                  rx={1.8}
                  fill="#FFF7CC"
                  opacity={0.85}
                />
              )}
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
                border: `2px solid ${palette.stroke}`,
              }}
            />
            <span style={{ fontSize: "0.85rem", color: colors.inkBrown }}>
              {t(`table.state.${state}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
