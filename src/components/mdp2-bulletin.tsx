import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import ReactMarkdown from "react-markdown";

export default function MdpBulletin() {
  const { data, isPending, error } = useQuery(
    convexQuery(api.bulletins.getMdp2Bulletins, {}),
  );

  return (
    <div className="flex flex-col gap-4 py-4">
      {isPending && (
        <div className="flex gap-4 flex-col">
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <Skeleton className="h-[125px] w-full rounded-xl" />
          <Skeleton className="h-[125px] w-full rounded-xl" />
        </div>
      )}
      {error && <p>{error.message}</p>}
      {data &&
        data.map((bulletin) => (
          <Card key={bulletin._id}>
            <CardHeader>
              <CardTitle>{bulletin.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-ul:list-disc prose-slate prose-li:list-disc">
                <ReactMarkdown>{bulletin.body}</ReactMarkdown>
              </div>
            </CardContent>
            <CardFooter>
              <p>{bulletin.author}</p>
            </CardFooter>
          </Card>
        ))}
    </div>
  );
}
