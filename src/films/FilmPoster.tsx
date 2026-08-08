const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

type PosterSize = "row" | "sheet";

type PosterVariant = { source: string; width: number; height: number };

function posterVariant(size: PosterSize): PosterVariant {
  if (size === "row") {
    return { source: "w154", width: 64, height: 96 };
  }
  return { source: "w342", width: 96, height: 144 };
}

export function FilmPoster(props: { title: string; posterPath: string | null; size: PosterSize }) {
  const variant = posterVariant(props.size);
  const className = props.size === "row" ? "poster poster-row" : "poster sheet-poster";

  if (props.posterPath === null) {
    return (
      <div
        class={`${className} poster-empty`}
        style={{ width: `${variant.width}px`, height: `${variant.height}px` }}
      >
        {props.title.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      class={className}
      src={`${IMAGE_BASE_URL}${variant.source}${props.posterPath}`}
      alt=""
      width={variant.width}
      height={variant.height}
      loading="lazy"
    />
  );
}
