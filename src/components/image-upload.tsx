import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "./ui/button";
import { Image } from "lucide-react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { FormEvent, useRef, useState } from "react";
import { Id } from "convex/_generated/dataModel";

export function ImageUpload({
  senderData,
}: {
  senderData: { authorId: Id<"users">; channel: Id<"channels"> | string };
}) {
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendImage = useMutation(api.messages.sendImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  async function handleSendImage(event: FormEvent) {
    event.preventDefault();

    // Step 1: Get a short-lived upload URL
    const postUrl = await generateUploadUrl();
    // Step 2: POST the file to the URL
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage!.type },
      body: selectedImage,
    });
    const { storageId } = await result.json();
    // Step 3: Save the newly allocated storage id to the database
    await sendImage({
      storageId,
      author: senderData.authorId,
      channel: senderData.channel,
    });

    setSelectedImage(null);
    imageInput.current!.value = "";

    // send escape key
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center">
          <Image />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Image</DialogTitle>
          <DialogDescription>Choose an image file to send.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSendImage} className="flex justify-between">
          <input
            type="file"
            accept="image/*"
            ref={imageInput}
            onChange={(event) => setSelectedImage(event.target.files![0])}
            disabled={selectedImage !== null}
            className="cursor-pointer"
          />
          <Button type="submit" disabled={selectedImage === null}>
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
