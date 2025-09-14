import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useRef } from "react";
import { Progress } from "./ui/progress";
import { FileIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  password: z.string().min(1, "Password is required"),
  info: z.string(),
  color: z.string(),
});

export function AddGroup() {
  const addGroupMutation = useConvexMutation(api.etcFunctions.addGroup);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      password: "",
      info: "",
      color: "#000000",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsUploading(true);
      let documentStorageId: string | undefined = undefined;

      // Handle document upload if a file was selected
      if (selectedDocument) {
        setUploadProgress(0);

        // Get upload URL from Convex
        const postUrl = await generateUploadUrl();

        // Upload file with progress tracking
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress((e.loaded / e.total) * 100);
          }
        });

        const uploadPromise = new Promise<string>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              const response = JSON.parse(xhr.responseText);
              resolve(response.storageId);
            } else {
              reject(new Error("Upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Upload error"));
        });

        xhr.open("POST", postUrl);
        xhr.setRequestHeader("Content-Type", selectedDocument.type);
        xhr.send(selectedDocument);

        documentStorageId = await uploadPromise;

        // Clear the file selection
        setSelectedDocument(null);
        if (documentInput.current) {
          documentInput.current.value = "";
        }
      }

      await addGroupMutation({
        name: values.name,
        description: values.description,
        password: values.password,
        info: values.info,
        document: documentStorageId,
        color: values.color,
      });

      toast.success("Group created successfully!");
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add Group</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Info</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Document (PDF) - Optional</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,application/pdf"
                    ref={documentInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.type !== "application/pdf") {
                          toast.error("Please select a PDF file");
                          e.target.value = "";
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          // 10MB limit
                          toast.error("File size must be less than 10MB");
                          e.target.value = "";
                          return;
                        }
                        setSelectedDocument(file);
                      } else {
                        setSelectedDocument(null);
                      }
                    }}
                    disabled={isUploading}
                  />
                  {selectedDocument && (
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <FileIcon className="w-4 h-4" />
                      <span className="text-sm text-muted-foreground">
                        {selectedDocument.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(null);
                          if (documentInput.current) {
                            documentInput.current.value = "";
                          }
                        }}
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {isUploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Uploading... {Math.round(uploadProgress)}%
                      </p>
                    </div>
                  )}
                </div>
              </FormControl>
              <FormDescription>
                Upload a PDF document (max 10MB) - Optional
              </FormDescription>
            </FormItem>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? "Creating..." : "Create Group"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

