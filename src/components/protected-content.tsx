import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
// TODO: fix this style import jankyness
import styles from "~/styles/markdown.txt?raw";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

export function ProtectedContent({ password }: { password: string }) {
  const {
    data: bulletins,
    isLoading,
    isError,
  } = useQuery(convexQuery(api.bulletins.getBulletinsByPassword, { password }));

  const { data: group } = useQuery(
    convexQuery(api.etcFunctions.getGroupByPassword, { password }),
  );

  if (isLoading) return <p>Loading...</p>;

  if (isError) return <p>Error</p>;

  return (
    <>
      <h2 className="text-2xl font-bold mb-4">{group?.name.toUpperCase()}</h2>
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
                  <div className={styles}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {bulletin.body}
                    </ReactMarkdown>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </div>
          ))}
      </Accordion>
    </>
  );
}
