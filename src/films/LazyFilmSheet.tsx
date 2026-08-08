import { lazy, Suspense } from "octane";
import type { FilmSheetProps } from "./FilmSheet";

function loadFilmSheet() {
  return import("./FilmSheet");
}

export function prefetchFilmSheet(): void {
  void loadFilmSheet();
}

const FilmSheet = lazy(() => loadFilmSheet().then((module) => ({ default: module.FilmSheet })));

export function LazyFilmSheet(props: FilmSheetProps) {
  return (
    <Suspense fallback={null}>
      <FilmSheet {...props} />
    </Suspense>
  );
}
