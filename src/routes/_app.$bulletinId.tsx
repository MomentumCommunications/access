import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ArrowLeft, EyeOff } from "lucide-react";
import { useMemo } from "react";
import { Markdown } from "~/components/markdown-wrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { formatBulletinDate } from "~/lib/bulletin-date";
import { cn } from "~/lib/utils";

type Bulletin = {
  _id: Id<"bulletin">;
  title: string;
  body: string;
  pinned: boolean;
  image?: string;
  date?: string;
  endDate?: string;
  author?: string;
  group?: string[];
  groups?: Id<"groups">[];
  reactions?: Id<"reactions">;
  hidden?: boolean;
};

type Group = {
  _id: Id<"groups">;
  name: string;
};

export const Route = createFileRoute("/_app/$bulletinId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { bulletinId } = Route.useParams();
  const bulletin = useQuery(api.bulletins.getBulletin, {
    id: bulletinId as Id<"bulletin">,
  });
  const groups = useQuery(api.etcFunctions.getGroups, {});
  const navigate = useNavigate();

  if (bulletin === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col px-2 pb-2">
        <p>Loading...</p>
      </div>
    );
  }

  if (bulletin === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 pb-2">
        <BackButton />
        <p>Bulletin not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-2 pb-12">
      <BackButton />
      {bulletin.image && (
        <img
          src={bulletin.image}
          alt={bulletin.title}
          className="max-h-[420px] w-full rounded object-cover"
        />
      )}
      <div className="flex flex-col gap-2">
        {bulletin.date && (
          <p
            className={cn(
              "text-muted-foreground text-sm",
              bulletin.hidden && "text-muted-foreground/70",
            )}
          >
            {formatBulletinDate(bulletin)}
          </p>
        )}
        <div className="flex items-center gap-2">
          {bulletin.hidden && <EyeOff className="text-muted-foreground h-5 w-5" />}
          <h1
            className={cn(
              "text-foreground text-3xl font-bold",
              bulletin.hidden && "text-muted-foreground",
            )}
          >
            {bulletin.title}
          </h1>
        </div>
        <GroupBadges bulletin={bulletin} groups={groups || []} />
      </div>
      <Separator className="bg-muted" />
      <div className="bg-muted rounded p-4">
        <Markdown content={bulletin.body} />
      </div>
    </div>
  );

  function BackButton() {
    return (
      <div className="flex w-full items-center justify-end">
        <Button variant={"link"} onClick={() => navigate({ to: "/home" })}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      </div>
    );
  }
}

function GroupBadges({
  bulletin,
  groups,
}: {
  bulletin: Bulletin;
  groups: Group[];
}) {
  const groupNames = useMemo(() => {
    if (bulletin.groups && bulletin.groups.length > 0) {
      return groups
        .filter((group) => bulletin.groups?.includes(group._id))
        .map((group) => group.name);
    }

    return bulletin.group || [];
  }, [bulletin, groups]);

  if (groupNames.length === 0) {
    return null;
  }

  if (groupNames.length === groups.length && groups.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        <Badge className="font-bold">ALL</Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groupNames.map((groupName) => (
        <Badge key={groupName} className="font-bold">
          {groupName.toUpperCase()}
        </Badge>
      ))}
    </div>
  );
}
