import type { TeamMember } from "../mock-data";
import { Badge } from "@/components/ui/badge";

export function TeamAvatars({ members }: { members: TeamMember[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {members.map((member) => (
          <div
            key={member.id}
            title={member.name}
            className="border-background bg-secondary text-secondary-foreground flex size-8 items-center justify-center rounded-full border-2 font-mono text-xs font-bold"
          >
            {member.name.slice(0, 1)}
          </div>
        ))}
      </div>
      <Badge variant="outline">{members.length}명</Badge>
    </div>
  );
}

export function PersonalBadge() {
  return <Badge variant="outline">개인 프로젝트</Badge>;
}
