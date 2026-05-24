import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Markdown } from "./markdown-wrapper";
import { Id } from "convex/_generated/dataModel";
import { formatBulletinDate, getBulletinSortDate } from "~/lib/bulletin-date";

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
    (bulletin) =>
      (getBulletinSortDate(bulletin)?.getTime() || 0) > tomorrow.getTime(),
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
            <div key={groupDoc.groupId} className="rounded-lg border p-4">
              <h3 className="mb-2 text-lg font-semibold">
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
              className="border-muted mb-4 rounded border p-4"
            >
              {bulletin.image && (
                <div className="flex w-full justify-center pb-4">
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
                    {formatBulletinDate(bulletin)}
                  </p>
                )}
                <p className="text-xl font-bold">{bulletin.title}</p>
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
