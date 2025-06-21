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
import remarkGfm from "remark-gfm";

export default function MdpBulletin() {
  const { data, isPending, error } = useQuery(
    convexQuery(api.bulletins.getMdpBulletins, {}),
  );

  const content = `# Test Markdown

- List item 1
- List item 2

| Column 1 | Column 2 |
|----------|----------|
| Row 1    | Data     |
| Row 2    | More     |`;

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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {bulletin.body}
              </ReactMarkdown>
            </CardContent>
            <CardFooter>
              <p>{bulletin.author}</p>
            </CardFooter>
          </Card>
        ))}
      <div className="prose bg-slate-100 dark:bg-slate-800 prose-slate">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
