import type { TableState } from "@loppemarked/shared";

export const TABLE_STATE_COLORS: Record<TableState, { background: string; text: string; border: string }> = {
  available: { background: "#EAF0E5", text: "#5C6B52", border: "#7A8B6F" },
  occupied: { background: "#F5EDE5", text: "#A8623A", border: "#C67D4B" },
  reserved: { background: "#F4E8D4", text: "#7A5820", border: "#B88A3A" },
};
