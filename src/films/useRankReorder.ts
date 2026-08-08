import { useLayoutEffect, useRef } from "octane";

const DURATION_MILLISECONDS = 200;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches;
}

export function useRankReorder(list: { current: HTMLOListElement | null }, order: string): void {
  const previousTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) {
      return;
    }

    const tops = new Map<string, number>();
    for (const row of element.querySelectorAll<HTMLElement>("[data-film]")) {
      const key = row.dataset["film"];
      if (key === undefined) {
        continue;
      }
      const top = row.offsetTop;
      tops.set(key, top);

      const previousTop = previousTops.current.get(key);
      if (previousTop === undefined || previousTop === top || prefersReducedMotion()) {
        continue;
      }
      row.animate(
        [{ transform: `translateY(${previousTop - top}px)` }, { transform: "translateY(0px)" }],
        { duration: DURATION_MILLISECONDS, easing: "ease-out" },
      );
    }

    previousTops.current = tops;
  }, [order]);
}
