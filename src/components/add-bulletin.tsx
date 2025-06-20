import * as React from "react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useIsMobile } from "~/hooks/use-mobile";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";

export function AddBulletin() {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Add Bulletin</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Bulletin</DialogTitle>
            <DialogDescription>
              What would you like everyone to know?
            </DialogDescription>
          </DialogHeader>
          <BulletinForm />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">Add Bulletin</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>New Bulletin</DrawerTitle>
          <DrawerDescription>
            What would you like everyone to know?
          </DrawerDescription>
        </DrawerHeader>
        <BulletinForm className="px-4" />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function BulletinForm({ className }: React.ComponentProps<"form">) {
  // Get mutation function from Convex
  const mutationFn = useConvexMutation(api.bulletins.createBulletin);

  // Wrap it with react-query's useMutation
  // const { mutate } = useMutation(mutationFn);

  return (
    <form
      className={cn("grid items-start gap-6", className)}
      onSubmit={(e) => {
        e.preventDefault(); // prevent default submit first

        const form = e.currentTarget;
        const title = form.post.value;
        const body = form.body.value;

        mutationFn({ title, body });

        form.reset();
      }}
    >
      <div className="grid gap-3">
        <Label htmlFor="post">Title</Label>
        <Input id="post" name="post" />
      </div>
      <div className="grid gap-3">
        <Label htmlFor="body">Body</Label>
        <Input id="body" name="body" />
      </div>
      <Button type="submit">Save changes</Button>
    </form>
  );
}
