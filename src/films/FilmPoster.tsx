const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w92";
const WIDTH = 48;
const HEIGHT = 72;

export function FilmPoster(props: { title: string; posterPath: string | null }) {
  if (props.posterPath === null) {
    return (
      <div class="poster poster-empty" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
        {props.title.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      class="poster"
      src={`${IMAGE_BASE_URL}${props.posterPath}`}
      alt=""
      width={WIDTH}
      height={HEIGHT}
      loading="lazy"
    />
  );
}
