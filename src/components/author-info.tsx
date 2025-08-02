import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { UserIcon } from "lucide-react";

export default function AuthorInfo({ author }: { author: Id<"users"> }) {
  if (!author) {
    return null;
  }

  const { data } = useQuery(convexQuery(api.users.getUserById, { id: author }));

  return (
    <div className="flex items-center flex-row gap-2">
      <Avatar className="border border-muted">
        <AvatarImage src={data?.image} alt={data?.name} />
        <AvatarFallback>
          <UserIcon />
        </AvatarFallback>
      </Avatar>
      {data?.displayName ? (
        <p className="tracking-tight">{data?.displayName}</p>
      ) : (
        <p className="tracking-tight">{data?.name}</p>
      )}
    </div>
  );
}
