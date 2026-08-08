import type { Vote } from "../../convex/votes";

export function VoteColumn(props: {
  title: string;
  vote: Vote;
  score: number;
  onVote: (direction: "up" | "down") => void;
}) {
  return (
    <span class="votes">
      <button
        class={props.vote === "up" ? "arrow arrow-active" : "arrow"}
        type="button"
        aria-label={`Vote up ${props.title}`}
        aria-pressed={props.vote === "up"}
        onClick={() => props.onVote("up")}
      >
        ▲
      </button>
      <span class={props.score === 0 ? "score score-zero" : "score"}>{props.score}</span>
      <button
        class={props.vote === "down" ? "arrow arrow-active" : "arrow"}
        type="button"
        aria-label={`Vote down ${props.title}`}
        aria-pressed={props.vote === "down"}
        onClick={() => props.onVote("down")}
      >
        ▼
      </button>
    </span>
  );
}
