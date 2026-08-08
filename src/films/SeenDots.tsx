import type { Id } from "../../convex/_generated/dataModel";
import type { Member } from "../../convex/users";

export function SeenDots(props: { members: Array<Member>; seenBy: Array<Id<"users">> }) {
  return (
    <span class="dots">
      {props.members.map((member) => (
        <span
          key={member.id}
          class={props.seenBy.includes(member.id) ? "dot dot-seen" : "dot"}
          title={member.name}
        />
      ))}
    </span>
  );
}
