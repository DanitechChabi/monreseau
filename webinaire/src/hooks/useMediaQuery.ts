import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Petit écran ou écran tactile : on allège les animations. */
export function useLightMotion(): boolean {
  return useMediaQuery("(max-width: 639px), (pointer: coarse)");
}
