import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

export function PdfEmbed({
  storageId,
  studentId,
  title,
  embedClassName,
}: {
  storageId: Id<"_storage">;
  studentId: Id<"students">;
  title: string;
  embedClassName?: string;
}) {
  const {
    data: url,
    isPending,
    isError,
  } = useQuery(
    convexQuery(api.classes.getBuddySheetUrl, {
      student: studentId,
      storageId,
    }),
  );

  if (isPending) {
    return (
      <div
        role="status"
        className="text-muted-foreground flex items-center gap-2 py-6 text-sm"
      >
        <Spinner aria-hidden="true" className="size-4" />
        Loading buddy sheet...
      </div>
    );
  }

  if (isError || !url) {
    return (
      <p className="text-muted-foreground text-sm">Buddy sheet unavailable.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open PDF: ${title}`}
          >
            <ExternalLink />
            Open PDF
          </a>
        </Button>
      </div>
      <embed
        src={url}
        type="application/pdf"
        title={title}
        width="100%"
        height="600px"
        className={cn("w-full rounded-md border bg-white", embedClassName)}
      />
    </div>
  );
}
