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
import { formatBulletinDate, getBulletinSortDate } from "~/lib/bulletin-date";

export function BulletinFeed() {
  const {
    data: bulletins,
    isLoading,
    isError,
  } = useQuery(convexQuery(api.bulletins.getMyBulletins, {}));

  const { data: groupDocuments } = useQuery(
    convexQuery(api.etcFunctions.getMyGroupDocuments, {}),
  );

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() - 1);

  const futureBulletins = bulletins?.filter(
    (bulletin) =>
      (getBulletinSortDate(bulletin)?.getTime() || 0) > tomorrow.getTime(),
  );

  if (isLoading) return <p>Loading...</p>;

  if (isError) {
    return (
      <p className="text-muted-foreground">
        Events are temporarily unavailable.
      </p>
    );
  }

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
        defaultValue={futureBulletins?.[0]?._id}
      >
        {futureBulletins?.length ? (
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
                {bulletin.subtitle && (
                  <p className="text-muted-foreground text-sm">
                    {bulletin.subtitle}
                  </p>
                )}
                {bulletin.venue && (
                  <p className="text-muted-foreground text-sm">
                    {bulletin.venue.name}
                  </p>
                )}
              </div>
              <AccordionItem value={bulletin._id}>
                <AccordionTrigger className="text-sm">Details</AccordionTrigger>
                <AccordionContent className="bg-muted rounded p-4">
                  <Markdown content={bulletin.body} />
                </AccordionContent>
              </AccordionItem>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No upcoming events</p>
            <p className="text-muted-foreground mt-1 text-sm">
              New events for your groups will appear here.
            </p>
          </div>
        )}
      </Accordion>
    </>
  );
}
