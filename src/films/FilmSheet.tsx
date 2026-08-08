import { Dialog } from "@octanejs/base-ui/dialog";
import type { GroupFilm } from "../../convex/films";
import type { Member } from "../../convex/users";
import type { Vote } from "../../convex/votes";
import { FilmPoster } from "./FilmPoster";
import { filmSpecification } from "./specification";
import { VoteColumn } from "./VoteColumn";

export type FilmSheetProps = {
  groupFilm: GroupFilm;
  members: Array<Member>;
  vote: Vote;
  score: number;
  seen: boolean;
  onVote: (direction: "up" | "down") => void;
  onToggleSeen: () => void;
  onClose: () => void;
};

export function FilmSheet(props: FilmSheetProps) {
  const seenNames = props.members
    .filter((member) => props.groupFilm.seenBy.includes(member.id))
    .map((member) => member.name);

  return (
    <Dialog.Root
      open
      onOpenChange={(open: boolean) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop class="sheet-backdrop" />
        <Dialog.Popup class="sheet">
          <div class="sheet-head">
            <FilmPoster
              size="sheet"
              title={props.groupFilm.film.title}
              posterPath={props.groupFilm.film.posterPath}
            />
            <div class="sheet-text">
              <Dialog.Title class="film-name">{props.groupFilm.film.title}</Dialog.Title>
              <p class="label">{filmSpecification(props.groupFilm.film)}</p>
            </div>
            <VoteColumn
              title={props.groupFilm.film.title}
              vote={props.vote}
              score={props.score}
              onVote={props.onVote}
            />
          </div>

          <button
            class={props.seen ? "button button-wide button-marked" : "button button-wide"}
            type="button"
            aria-label={`Seen ${props.groupFilm.film.title}`}
            aria-pressed={props.seen}
            onClick={props.onToggleSeen}
          >
            {props.seen ? "Seen by me" : "Mark seen"}
          </button>

          <section class="section">
            <p class="section-head">
              <span class="label">Seen by</span>
            </p>
            {seenNames.length === 0 ? (
              <p class="muted">Nobody yet.</p>
            ) : (
              <p>{seenNames.join(", ")}</p>
            )}
          </section>

          <Dialog.Close class="button button-wide">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
