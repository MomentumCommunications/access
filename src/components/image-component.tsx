import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

export function ImageComponent({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useConvexQuery(api.etcFunctions.getUrlForImage, { storageId });
  if (!url) return null;
  return (
    <img 
      src={url} 
      className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4 rounded-lg" 
      loading="lazy"
      width="400"
      height="300"
      alt="User uploaded image"
    />
  );
}
