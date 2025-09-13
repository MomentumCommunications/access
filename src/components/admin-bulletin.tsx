import { convexQuery, useConvexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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
import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
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
import { Separator } from "./ui/separator";

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
          className="px-0 size-8 has-[>svg]:px-2 mx-0 w-full justify-start"
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

  const pastBulletins = bulletins?.filter(
    // @ts-expect-error ts(2349)
    (bulletin) => new Date(bulletin?.date) < Date.now(),
  );

  const futureBulletins = bulletins?.filter(
    // @ts-expect-error ts(2349)
    (bulletin) => new Date(bulletin?.date) > Date.now(),
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
      <div className="flex justify-end flex-row h-6 items-center gap-2">
        <Button
          id="past-bulletins-toggle"
          variant="link"
          className="text-xs px-0"
          onClick={togglePastBulletins}
        >
          Toggle past events
        </Button>
        <Separator orientation="vertical" className="h-full" />
        <Button variant="link" className="text-xs px-0" asChild>
          <a href="/directory">Directory</a>
        </Button>
      </div>
      <div id="past-bulletins" className="hidden">
        <h2 className="text-2xl font-bold mb-4">Past Events</h2>
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
                className="p-4 mb-4 border border-muted rounded"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2">
                    {bulletin.image && (
                      <img
                        src={bulletin.image}
                        alt={bulletin.title}
                        className="w-full md:w-1/3 rounded"
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
                          {format(
                            toZonedTime(new Date(bulletin.date), "utc"),
                            "iii ⋅ MMMM d, yyyy",
                          )}
                        </p>
                      )}
                      <div className="z-10 ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 cursor-pointer"
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
                  <div className="flex flex-col w-full items-start gap-2 items-center">
                    <div className="flex gap-2">
                      {bulletin.hidden && (
                        <EyeOff className="text-muted-foreground" />
                      )}
                      <p
                        className={cn(
                          "font-bold text-xl",
                          bulletin.hidden && "text-muted-foreground",
                        )}
                      >
                        {bulletin.title}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {
                        // This is not as slick as querying the groups for the exact number,
                        // but this doesn't change very often and I'll save the call to the database.
                        bulletin.group?.length === 4 ? (
                          <Badge className="font-bold">ALL</Badge>
                        ) : (
                          bulletin.group?.map((group) => (
                            <Badge key={group} className="font-bold">
                              {group.toUpperCase()}
                            </Badge>
                          ))
                        )
                      }
                    </div>
                  </div>
                </div>
                <AccordionItem value={bulletin._id}>
                  <AccordionTrigger className="text-sm">
                    Details
                  </AccordionTrigger>
                  <AccordionContent className="bg-muted p-4 rounded">
                    <Markdown content={bulletin.body} />
                  </AccordionContent>
                </AccordionItem>
              </div>
            ))}
        </Accordion>
      </div>
      <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
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
              className="p-4 mb-4 border border-muted rounded"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  {bulletin.image && (
                    <img
                      src={bulletin.image}
                      alt={bulletin.title}
                      className="w-full md:w-1/3 rounded"
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
                        {format(
                          toZonedTime(new Date(bulletin.date), "utc"),
                          "iii ⋅ MMMM d, yyyy",
                        )}
                      </p>
                    )}
                    <div className="z-10 ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 cursor-pointer"
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
                <div className="flex flex-col w-full items-start gap-2 items-center">
                  <div className="flex gap-2">
                    {bulletin.hidden && (
                      <EyeOff className="text-muted-foreground" />
                    )}
                    <p
                      className={cn(
                        "font-bold text-xl",
                        bulletin.hidden && "text-muted-foreground",
                      )}
                    >
                      {bulletin.title}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {
                      // This is not as slick as querying the groups for the exact number,
                      // but this doesn't change very often and I'll save the call to the database.
                      bulletin.group?.length === 4 ? (
                        <Badge className="font-bold">ALL</Badge>
                      ) : (
                        bulletin.group?.map((group) => (
                          <Badge key={group} className="font-bold">
                            {group.toUpperCase()}
                          </Badge>
                        ))
                      )
                    }
                  </div>
                </div>
              </div>
              <AccordionItem value={bulletin._id}>
                <AccordionTrigger className="text-sm">Details</AccordionTrigger>
                <AccordionContent className="bg-muted p-4 rounded">
                  <Markdown content={bulletin.body} />
                </AccordionContent>
              </AccordionItem>
            </div>
          ))}
      </Accordion>
    </>
  );
}
