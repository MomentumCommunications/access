import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { ArrowLeft, Hash, MessageSquare } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { generateMessageLink } from "~/lib/message-utils";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  component: SearchResults,
});

function SearchResults() {
  const navigate = useNavigate();
  const { q: query } = useSearch({ from: "/_app/search" });
  const { user } = useUser();

  const { data: convexUser } = useQuery({
    ...convexQuery(api.users.getUserByClerkId, { ClerkId: user?.id }),
    enabled: !!user?.id,
  });

  const { data: searchResults, isLoading } = useQuery({
    ...convexQuery(api.messages.searchMessages, {
      query: query || "",
      userId: convexUser?._id!,
      limit: 50,
    }),
    enabled: !!convexUser?._id && query.length > 1,
  });

  const handleMessageClick = (
    messageId: string,
    channelId: string,
    isDM: boolean,
  ) => {
    const messageLink = generateMessageLink(
      channelId as Id<"channels">,
      messageId as Id<"messages">,
      isDM,
    );
    navigate({ to: messageLink });
  };

  const handleSearchChange = (newQuery: string) => {
    navigate({
      to: "/search",
      search: { q: newQuery },
    });
  };

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/home" })}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-md"
            autoFocus
          />
        </div>
      </div>

      {query.length < 2 ? (
        <div className="text-center text-muted-foreground py-8">
          Enter at least 2 characters to search messages
        </div>
      ) : isLoading ? (
        <div className="text-center py-8">
          <div className="animate-pulse">Searching...</div>
        </div>
      ) : !searchResults?.length ? (
        <div className="text-center text-muted-foreground py-8">
          No messages found for &quot;{query}&quot;
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            Found {searchResults.length} result
            {searchResults.length !== 1 ? "s" : ""} for "{query}"
          </div>

          <div className="space-y-4">
            {searchResults.map((message) => (
              <Card
                key={message._id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() =>
                  handleMessageClick(
                    message._id,
                    message.channelInfo?.channelId || "",
                    message.channelInfo?.isDM || false,
                  )
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {message.channelInfo?.isDM ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Hash className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      {message.channelInfo?.name || "Unknown"}
                    </span>
                    <span>•</span>
                    <span>{message.authorName}</span>
                    <span>•</span>
                    <span>
                      {format(
                        new Date(message._creationTime),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: message.highlightedBody || message.body,
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

