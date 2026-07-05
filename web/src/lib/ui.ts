// Pure UI state only (panels, composers) — never app data (§14.2).

import { create } from "zustand";

type UiState = {
  openTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
};

export const useUi = create<UiState>((set) => ({
  openTaskId: null,
  openTask: (id) => set({ openTaskId: id }),
  closeTask: () => set({ openTaskId: null }),
}));

/** Curated project colors (§9.6) — token name -> hex, from spec/tokens. */
export const PROJECT_COLORS: Record<string, string> = {
  stone: "#78716C",
  clay: "#B45309",
  rose: "#BE185D",
  grape: "#7E22CE",
  indigo: "#4338CA",
  sky: "#0369A1",
  teal: "#0F766E",
  moss: "#4D7C0F",
  forest: "#166534",
  sand: "#A16207",
  cocoa: "#7C2D12",
  graphite: "#334155",
};
