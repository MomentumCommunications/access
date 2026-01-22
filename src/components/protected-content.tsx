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
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function ProtectedContent({ password }: { password: string }) {
  const {
    data: bulletins,
    isLoading,
    isError,
  } = useQuery(convexQuery(api.bulletins.getBulletinsByPassword, { password }));

  const { data: group } = useQuery(
    convexQuery(api.etcFunctions.getGroupByPassword, { password }),
  );

  const { data: document } = useQuery({
    ...convexQuery(api.etcFunctions.getUrlForDocument, {
      storageId: group?.document!,
    }),
    enabled: !!group?.document,
    initialData: null, // <-- avoids the "missing initialData" overload error
  });

  if (isLoading) return <p>Loading...</p>;

  if (isError) return <p>Error</p>;

  return (
    <>
      <Badge variant={"secondary"} className="text-2xl font-bold mb-4">
        {group?.name.toUpperCase()}
      </Badge>
      {document && (
        <>
          <embed
            src={document}
            type="application/pdf"
            width="100%"
            height="600px"
            className="bg-white"
          />
          <Button asChild variant="link">
            <a href={document} target="_blank" rel="noopener noreferrer">
              Open document in new tab
            </a>
          </Button>
        </>
      )}

      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={bulletins?.[0]?._id}
      >
        {bulletins &&
          bulletins.map((bulletin) => (
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
