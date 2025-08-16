import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "~/lib/utils";
import { useConvexQuery } from "@convex-dev/react-query";
import { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";

export function ImageComponent({ storageId }: { storageId: Id<"_storage"> }) {
  const imgUrl = useConvexQuery(api.etcFunctions.getUrlForImage, { storageId });
  const [isLandscape, setIsLandscape] = useState<boolean | null>(null);

  if (!imgUrl) return null;

  const handleDownload = async () => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `image-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4">
        <img
          src={imgUrl}
          className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          loading="lazy"
          alt="User uploaded image"
        />
      </DialogTrigger>
      <DialogContent
        className={cn(
          "p-0 flex items-center justify-center",
          // fallback while we don’t know
          isLandscape === null && "min-w-[95vw] max-h-[95vh]",
          // landscape: width is the limiter
          isLandscape === true && "min-w-[90vw] w-full max-h-[95vh]",
          // portrait: height is the limiter
          isLandscape === false && "min-h-[90vh] max-w-[95vw]",
        )}
      >
        <img
          src={imgUrl}
          alt="User uploaded image"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            setIsLandscape(naturalWidth >= naturalHeight);
          }}
          className="rounded-lg object-contain max-w-full max-h-full"
        />
        <div className="absolute bottom-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white bg-black/50 hover:bg-black/75"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
