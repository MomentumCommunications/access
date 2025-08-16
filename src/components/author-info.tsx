import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Shield, UserIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export default function AuthorInfo({ author }: { author: Id<"users"> }) {
  if (!author) {
    return null;
  }

  const { data, isLoading } = useQuery(
    convexQuery(api.users.getUserById, { id: author }),
  );

  if (isLoading) {
    return null;
  }

  const initials = data?.name
    .split(" ")
    .map((word) => word[0])
    .join("");

  const isAdmin = data?.role === "admin";

  return (
    <Sheet>
      <SheetTrigger className="flex items-center flex-row gap-2 cursor-pointer hover:underline underline-offset-2">
        <Avatar className="border border-muted">
          <AvatarImage src={data?.image} alt={data?.name} />
          <AvatarFallback>
            <UserIcon />
          </AvatarFallback>
        </Avatar>
        {data?.displayName ? data.displayName : data?.name}
        {isAdmin && (
          <Shield strokeWidth={3} size={16} className="text-gray-500" />
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="flex flex-col gap-1.5 p-4">
          <SheetTitle>Profile</SheetTitle>
          <SheetDescription className="flex py-4 gap-2 items-center flex-col">
            <Avatar className="size-56 md:size-72 border border-muted">
              <AvatarImage src={data?.image} alt={data?.name} />
              <AvatarFallback>
                {initials ? initials : <UserIcon />}
              </AvatarFallback>
            </Avatar>
            {data?.role === "admin" && (
              <div className="flex flex-row gap-1 justify-center">
                <Shield strokeWidth={3} size={16} className="text-gray-500" />
                <span className="text-muted-foreground">Admin</span>
              </div>
            )}
            <div className="flex flex-col py-2 text-left px-2 w-full gap-1">
              <p className="font-bold text-foreground text-lg">{data?.name}</p>
              {data?.displayName && (
                <p className="text-foreground text-sm">
                  {`@${data.displayName}`}
                </p>
              )}
            </div>
            {data?.description && (
              <div className="flex flex-col py-2 w-full px-2">
                <p className="font-bold text-foreground text-lg">About me</p>
                <p className="text-foreground whitespace-pre-wrap">
                  {data.description}
                </p>
              </div>
            )}
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}
