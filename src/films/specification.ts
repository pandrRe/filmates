import type { Film } from "../../convex/tmdb";

const SEPARATOR = " · ";

function surname(director: string): string {
  const parts = director.split(" ");
  return parts[parts.length - 1] ?? director;
}

export function filmSpecification(film: Film): string {
  const parts: Array<string> = [];
  if (film.year !== null) {
    parts.push(String(film.year));
  }
  if (film.runtime !== null) {
    parts.push(`${film.runtime} min`);
  }
  if (film.director !== null) {
    parts.push(surname(film.director));
  }
  return parts.join(SEPARATOR);
}
