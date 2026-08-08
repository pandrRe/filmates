import type { Id } from "../../convex/_generated/dataModel";
import type { Member } from "../../convex/users";

export function SeenMarks(props: { members: Array<Member>; seenBy: Array<Id<"users">> }) {
  return (
    <span class="marks">
      {props.members.map((member) => (
        <span
          key={member.id}
          class={props.seenBy.includes(member.id) ? "mark mark-seen" : "mark"}
          title={member.name}
        />
      ))}
    </span>
  );
}
