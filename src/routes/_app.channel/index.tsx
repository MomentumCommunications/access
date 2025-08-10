import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Hash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

export const Route = createFileRoute("/_app/channel/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useUser();

  const { data: convexUser } = useQuery(
    convexQuery(api.users.getUserByClerkId, { ClerkId: user?.id }),
  );

  const { data: channels, isLoading } = useQuery(
    convexQuery(api.channels.getChannelsByUser, { user: convexUser?._id }),
  );

  if (!channels) return null;

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Chat</h1>
        <div className="flex flex-col items-stretch max-w-[200px] w-full gap-2">
          <h2 className="text-xl font-semibold mt-4">Channels</h2>
          <Button asChild variant="outline" className="flex justify-start">
            <Link to="/channel/general">
              <Hash color="#ce2128" />
              <span>General</span>
            </Link>
          </Button>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="w-32 h-6" />
              <Skeleton className="w-32 h-6" />
              <Skeleton className="w-32 h-6" />
            </div>
          ) : (
            channels.map((channel) => (
              <Button
                asChild
                key={channel?._id}
                variant="outline"
                className="flex justify-start"
              >
                <Link to="/channel/$channel" params={{ channel: channel?._id }}>
                  <Hash color="#ce2128" />
                  <span>
                    <p>{channel?.name}</p>
                  </span>
                </Link>
              </Button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
