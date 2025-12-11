import { convexQuery } from "@convex-dev/react-query";
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
import { Markdown } from "./markdown-wrapper";
import { Id } from "convex/_generated/dataModel";

export function BulletinFeed({ groups }: { groups: Id<"groups">[] }) {
  const {
    data: bulletins,
    isLoading,
    isError,
  } = useQuery(convexQuery(api.bulletins.getBulletinsByGroups, { groups }));

  // Fetch group documents with URLs in one query
  const { data: groupDocuments } = useQuery(
    convexQuery(api.etcFunctions.getGroupDocuments, { groupIds: groups }),
  );

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() - 1);

  const futureBulletins = bulletins?.filter(
    // @ts-expect-error ts(2349)
    (bulletin) => new Date(bulletin?.date) > tomorrow,
  );

  // const { data: group } = useQuery(
  //   convexQuery(api.etcFunctions.getGroupByPassword, { password }),
  // );

  if (isLoading) return <p>Loading...</p>;

  if (isError) return <p>Error</p>;

  if (groups.length === 0) return <p>No bulletins</p>;

  return (
    <>
      {/* Group Documents */}
      {groupDocuments && groupDocuments.length > 0 && (
        <div className="mb-6 space-y-4">
          {groupDocuments.map((groupDoc) => (
            <div key={groupDoc.groupId} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">
                {groupDoc.groupName} Document
              </h3>
              <embed
                src={groupDoc.documentUrl!}
                type="application/pdf"
                width="100%"
                height="600px"
                className="rounded border bg-white"
              />
            </div>
          ))}
        </div>
      )}

      {/* Bulletins */}
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={bulletins?.[0]?._id}
      >
        {bulletins &&
          futureBulletins?.map((bulletin) => (
            <div
              key={bulletin._id}
              className="p-4 mb-4 border border-muted rounded"
            >
              {bulletin.image && (
                <div className="flex w-full pb-4 justify-center">
                  <img
                    src={bulletin.image}
                    alt={bulletin.title}
                    className="w-full rounded"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {bulletin.date && (
                  <p className="align-baseline">
                    {format(
                      toZonedTime(new Date(bulletin.date), "utc"),
                      "iii, MMMM d, yyyy",
                    )}
                  </p>
                )}
                <p className="font-bold text-xl">{bulletin.title}</p>
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
