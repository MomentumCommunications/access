import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Eye, EyeOff, LinkIcon, MoreHorizontal, Trash2 } from "lucide-react";
import { Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { cn } from "~/lib/utils";
import { EditBulletin } from "./edit-bulletin";
import { Badge } from "./ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Markdown } from "./markdown-wrapper";
import { formatBulletinDate, getBulletinSortDate } from "~/lib/bulletin-date";
import { Link } from "@tanstack/react-router";

type Bulletin = {
  _id: Id<"bulletin">;
  title: string;
  body: string;
  pinned: boolean;
  image?: string;
  date: string;
  endDate?: string;
  author?: string;
  audience?: "all";
  group: string[];
  groups: Id<"groups">[];
  hidden: boolean;
};

// Helper component to display group badges
function GroupBadges({
  bulletin,
  groups,
}: {
  bulletin: Bulletin;
  groups: Array<{ _id: Id<"groups">; name: string }>;
}) {
  const groupNames = useMemo(() => {
    // Prefer new groups field over old group field
    if (bulletin.groups && bulletin.groups.length > 0) {
      return groups
        .filter((g) => bulletin.groups.includes(g._id))
        .map((g) => g.name);
    }
    // Fallback to old group field
    return bulletin.group || [];
  }, [bulletin, groups]);

  if (bulletin.audience === "all") {
    return <Badge className="font-bold">ALL USERS</Badge>;
  }

  // Show ALL badge if all groups are selected
  if (groupNames.length === groups.length && groups.length > 0) {
    return <Badge className="font-bold">ALL</Badge>;
  }

  return (
    <>
      {groupNames.map((groupName: string) => (
        <Badge key={groupName} className="font-bold">
          {groupName.toUpperCase()}
        </Badge>
      ))}
    </>
  );
}

function DeleteButton({
  id,
  postTitle,
}: {
  id: Id<"bulletin">;
  postTitle: string;
}) {
  const deleteFunction = useMutation(api.bulletins.deleteBulletin);

  const deleteBulletin = () => {
    deleteFunction({ id });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          className="size-8 has-[>svg]:px-2 mx-0 w-full justify-start px-0"
        >
          <Trash2 color="red" />
          <span className="text-red-500">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete &quot;{postTitle}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteBulletin}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function togglePastBulletins() {
  const pastBulletins = document.getElementById("past-bulletins");
  pastBulletins?.classList.toggle("hidden");
}

export function AdminBulletin() {
  const {
    data: bulletins,
    isLoading,
    isError,
  } = useQuery(convexQuery(api.bulletins.getAllBulletins, {}));

  const { data: groups } = useQuery(
    convexQuery(api.etcFunctions.getGroups, {}),
  );

  const pastBulletins = bulletins?.filter(
    (bulletin) => (getBulletinSortDate(bulletin)?.getTime() || 0) < Date.now(),
  );

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() - 1);

  const futureBulletins = bulletins?.filter(
    (bulletin) =>
      (getBulletinSortDate(bulletin)?.getTime() || 0) > tomorrow.getTime(),
  );

  const hideFunction = useMutation(api.bulletins.hideBulletin);

  const hideBulletin = (id: Id<"bulletin">) => {
    hideFunction({ id });
  };

  const unhideFunction = useMutation(api.bulletins.unhideBulletin);

  const unhideBulletin = (id: Id<"bulletin">) => {
    unhideFunction({ id });
  };

  if (!bulletins) return <p>No bulletins</p>;

  if (isLoading) return <p>Loading...</p>;

  if (isError) return <p>Error</p>;

  return (
    <>
      <div className="flex h-6 flex-row items-center justify-end gap-2">
        <Button
          id="past-bulletins-toggle"
          variant="link"
          className="px-0 text-xs"
          onClick={togglePastBulletins}
        >
          Toggle past events
        </Button>
      </div>
      <div id="past-bulletins" className="hidden py-6">
        <h2 className="mb-4 text-2xl font-bold">Past Events</h2>
        <Accordion
          type="single"
          collapsible
          className="w-full"
          defaultValue={pastBulletins?.[0]?._id}
        >
          {pastBulletins &&
            pastBulletins.map((bulletin) => (
              <div
                key={bulletin._id}
                className="border-muted mb-4 rounded border p-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    {bulletin.image && (
                      <img
                        src={bulletin.image}
                        alt={bulletin.title}
                        className="w-full rounded md:w-1/3"
                      />
                    )}
                    <div className="flex justify-between">
                      {bulletin.date && (
                        <p
                          className={cn(
                            "align-baseline",
                            bulletin.hidden && "text-muted-foreground",
                          )}
                        >
                          {formatBulletinDate(bulletin)}
                        </p>
                      )}
                      <div className="z-10 ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 cursor-pointer p-0"
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <EditBulletin bulletin={bulletin} />
                            </DropdownMenuItem>
                            {!bulletin.hidden && (
                              <DropdownMenuItem
                                onClick={() => {
                                  hideBulletin(bulletin._id);
                                }}
                              >
                                <EyeOff />
                                <span>Hide</span>
                              </DropdownMenuItem>
                            )}
                            {bulletin.hidden && (
                              <DropdownMenuItem
                                onClick={() => {
                                  unhideBulletin(bulletin._id);
                                }}
                              >
                                <Eye />
                                <span>Unhide</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <DeleteButton
                                id={bulletin._id}
                                postTitle={bulletin.title}
                              />
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-center gap-2">
                    <div className="flex gap-2">
                      {bulletin.hidden && (
                        <EyeOff className="text-muted-foreground" />
                      )}
                      <p
                        className={cn(
                          "text-xl font-bold",
                          bulletin.hidden && "text-muted-foreground",
                        )}
                      >
                        {bulletin.title}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <GroupBadges bulletin={bulletin} groups={groups || []} />
                    </div>
                  </div>
                </div>
                <AccordionItem value={bulletin._id}>
                  <AccordionTrigger className="text-sm">
                    Details
                  </AccordionTrigger>
                  <AccordionContent className="bg-muted rounded p-4">
                    <Markdown content={bulletin.body} />
                  </AccordionContent>
                </AccordionItem>
              </div>
            ))}
        </Accordion>
      </div>
      <h2 className="mb-4 pt-6 text-2xl font-bold">Upcoming Events</h2>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={futureBulletins?.[0]?._id}
      >
        {futureBulletins &&
          futureBulletins.map((bulletin) => (
            <div
              key={bulletin._id}
              className="border-muted mb-4 rounded border p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  {bulletin.image && (
                    <img
                      src={bulletin.image}
                      alt={bulletin.title}
                      className="w-full rounded md:w-1/3"
                    />
                  )}
                  <div className="flex justify-between">
                    {bulletin.date && (
                      <p
                        className={cn(
                          "align-baseline",
                          bulletin.hidden && "text-muted-foreground",
                        )}
                      >
                        {formatBulletinDate(bulletin)}
                      </p>
                    )}
                    <div className="z-10 ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 cursor-pointer p-0"
                          >
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              to="/calendar/$bulletinId"
                              params={{ bulletinId: bulletin._id }}
                            >
                              <LinkIcon />
                              <span>View</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <EditBulletin bulletin={bulletin} />
                          </DropdownMenuItem>
                          {!bulletin.hidden && (
                            <DropdownMenuItem
                              onClick={() => {
                                hideBulletin(bulletin._id);
                              }}
                            >
                              <EyeOff />
                              <span>Hide</span>
                            </DropdownMenuItem>
                          )}
                          {bulletin.hidden && (
                            <DropdownMenuItem
                              onClick={() => {
                                unhideBulletin(bulletin._id);
                              }}
                            >
                              <Eye />
                              <span>Unhide</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <DeleteButton
                              id={bulletin._id}
                              postTitle={bulletin.title}
                            />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                <div className="g ap-2 flex w-full flex-col items-start">
                  <div className="flex gap-2">
                    {bulletin.hidden && (
                      <EyeOff className="text-muted-foreground" />
                    )}
                    <p
                      className={cn(
                        "text-xl font-bold",
                        bulletin.hidden && "text-muted-foreground",
                      )}
                    >
                      {bulletin.title}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <GroupBadges bulletin={bulletin} groups={groups || []} />
                  </div>
                </div>
              </div>
              <AccordionItem value={bulletin._id}>
                <AccordionTrigger className="text-sm">Details</AccordionTrigger>
                <AccordionContent className="bg-muted rounded p-4">
                  <Markdown content={bulletin.body} />
                </AccordionContent>
              </AccordionItem>
            </div>
          ))}
      </Accordion>
    </>
  );
}
