import {
  useConvexAction,
  useConvexMutation,
  useConvexQuery,
} from "@convex-dev/react-query";
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { Camera, KeyRound, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";

const formSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "First name must be 80 characters or fewer"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(80, "Last name must be 80 characters or fewer"),
  phone: z.string().trim().max(30, "Phone number must be 30 characters or fewer"),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(80, "Display name must be 80 characters or fewer"),
  bio: z.string().max(1000),
});

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;

export const Route = createFileRoute("/_app/account")({
  component: RouteComponent,
});

function RouteComponent() {
  const convexUser = useConvexQuery(api.users.current, {});
  const activeEmailChange = useConvexQuery(
    api.users.getActiveEmailChange,
    {},
  );

  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [showEmailRequest, setShowEmailRequest] = useState(false);
  const [isRequestingEmailChange, setIsRequestingEmailChange] =
    useState(false);
  const [isConfirmingEmailChange, setIsConfirmingEmailChange] =
    useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] =
    useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      displayName: "",
      bio: convexUser?.description || "",
    },
  });

  const updateProfile = useConvexMutation(api.users.updateProfile);
  const requestEmailChange = useConvexAction(api.stripe.requestEmailChange);
  const confirmEmailChange = useConvexAction(api.stripe.confirmEmailChange);
  const requestAccountPasswordReset = useConvexAction(
    api.stripe.requestAccountPasswordReset,
  );
  const generateUploadUrl = useConvexMutation(
    api.users.generateProfileImageUploadUrl,
  );
  const previewUrl = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage) : undefined),
    [selectedImage],
  );
  const displayedName =
    form.watch("displayName") || convexUser?.displayName || convexUser?.name;
  const initials = displayedName
    ?.split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!convexUser) {
      return;
    }

    form.reset({
      firstName: convexUser.firstName || "",
      lastName: convexUser.lastName || "",
      phone: convexUser.phone || "",
      displayName: convexUser.displayName || convexUser.name || "",
      bio: convexUser.description || "",
    });
  }, [convexUser, form]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function uploadProfileImage() {
    if (!selectedImage) {
      return undefined;
    }

    const postUrl = await generateUploadUrl({});
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage.type },
      body: selectedImage,
    });

    if (!result.ok) {
      throw new Error("Profile image upload failed");
    }

    const { storageId } = (await result.json()) as {
      storageId: Id<"_storage">;
    };
    return storageId;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const imageStorageId = await uploadProfileImage();
      await updateProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        displayName: values.displayName,
        description: values.bio || undefined,
        ...(imageStorageId ? { imageStorageId } : {}),
      });
      setSelectedImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      toast.success("Profile updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profile could not be updated",
      );
    }
  }

  function handleImageChange(file?: File) {
    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      toast.error("Profile image must be 5 MB or smaller");
      return;
    }

    setSelectedImage(file);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      await navigate({ to: "/home" });
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleEmailChangeRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsRequestingEmailChange(true);
    try {
      await requestEmailChange({ newEmail, currentPassword });
      setCurrentPassword("");
      setEmailCode("");
      setShowEmailRequest(false);
      toast.success(`Verification code sent to ${newEmail.trim()}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Email change could not be started",
      );
    } finally {
      setIsRequestingEmailChange(false);
    }
  }

  async function handleEmailChangeConfirmation(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!activeEmailChange) return;
    setIsConfirmingEmailChange(true);
    try {
      await confirmEmailChange({
        challengeId: activeEmailChange.challengeId,
        code: emailCode,
      });
      setEmailCode("");
      setNewEmail("");
      toast.success("Login email updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Email change could not be confirmed",
      );
    } finally {
      setIsConfirmingEmailChange(false);
    }
  }

  async function handlePasswordResetRequest() {
    setIsRequestingPasswordReset(true);
    try {
      const result = await requestAccountPasswordReset({});
      await navigate({
        to: "/reset-password",
        search: { accountChallenge: result.challengeId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Password change could not be started",
      );
    } finally {
      setIsRequestingPasswordReset(false);
    }
  }

  const accountEmail = Array.isArray(convexUser?.email)
    ? convexUser.email[0]
    : convexUser?.email;
  const isEmailConfirmationVisible =
    Boolean(activeEmailChange) && !showEmailRequest;

  return (
    <div className="flex w-full flex-col items-center justify-start gap-6 px-2 pt-8 md:gap-12 md:px-4 md:py-24">
      <div className="flex w-full max-w-4xl flex-col gap-6 md:gap-12">
        <div className="flex w-full flex-col items-start gap-4 p-4">
          <div className="flex w-full flex-col gap-2">
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className="text-muted-foreground">
              Manage your account information and how your profile appears to
              other members.
            </p>
            <Separator />
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar
                    className="size-24 border"
                    style={{
                      width: 96,
                      height: 96,
                      minWidth: 96,
                      minHeight: 96,
                      maxWidth: 96,
                      maxHeight: 96,
                      overflow: "hidden",
                    }}
                  >
                    <AvatarImage
                      src={previewUrl || convexUser?.image}
                      alt={displayedName || "Profile photo"}
                      className="object-cover"
                      style={{
                        width: "100%",
                        height: "100%",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <AvatarFallback>
                      {initials || <User className="size-7" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full max-w-sm space-y-2">
                    <Label htmlFor="profile-image">Profile picture</Label>
                    <Input
                      ref={imageInputRef}
                      id="profile-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handleImageChange(event.target.files?.[0])
                      }
                    />
                    <FormDescription>
                      JPG, PNG, GIF, or WebP up to 5 MB.
                    </FormDescription>
                  </div>
                </div>
                <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="given-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="family-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>Phone number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" autoComplete="tel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>Display name</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" />
                      </FormControl>
                      <FormDescription>
                        This is the name other members will see.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About Me</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="h-64" />
                      </FormControl>
                      <FormDescription>
                        Characters: {field.value.length} / 1000
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="cursor-pointer"
                >
                  <Camera />
                  {form.formState.isSubmitting
                    ? "Saving profile..."
                    : "Save profile"}
                </Button>
              </form>
            </Form>
          </div>
          <Separator className="my-4" />
          <div className="w-full space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                <h2 className="text-2xl font-semibold">Security</h2>
              </div>
              <p className="mt-1 text-muted-foreground">
                Manage the email and password used to sign in.
              </p>
            </div>

            <div className="max-w-xl space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Mail className="size-4" />
                <h3 className="font-semibold">Login email</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Current email: {accountEmail || "Not set"}
              </p>

              {isEmailConfirmationVisible && activeEmailChange ? (
                <form
                  className="space-y-4"
                  onSubmit={handleEmailChangeConfirmation}
                >
                  <div className="space-y-2">
                    <Label htmlFor="email-change-code">
                      Verification code
                    </Label>
                    <Input
                      id="email-change-code"
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter the code sent to {activeEmailChange.newEmail}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={isConfirmingEmailChange}
                    >
                      {isConfirmingEmailChange
                        ? "Confirming..."
                        : "Confirm email"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewEmail(activeEmailChange.newEmail);
                        setShowEmailRequest(true);
                      }}
                    >
                      Start a new request
                    </Button>
                  </div>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={handleEmailChangeRequest}
                >
                  <div className="space-y-2">
                    <Label htmlFor="new-email">New email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current-password">
                      Current password
                    </Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      We will verify your password, then email a code to the
                      new address.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={isRequestingEmailChange}
                    >
                      {isRequestingEmailChange
                        ? "Sending code..."
                        : "Change email"}
                    </Button>
                    {activeEmailChange ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowEmailRequest(false)}
                      >
                        Back to verification
                      </Button>
                    ) : null}
                  </div>
                </form>
              )}
            </div>

            <div className="max-w-xl space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4" />
                <h3 className="font-semibold">Password</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                We will email a one-time code to your current login address
                before allowing a new password.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handlePasswordResetRequest}
                disabled={isRequestingPasswordReset}
              >
                {isRequestingPasswordReset
                  ? "Sending code..."
                  : "Change password"}
              </Button>
            </div>
          </div>
          <Separator className="my-4" />
          <h2 className="mb-4 text-2xl font-semibold">Had enough?</h2>
          <Button
            onClick={handleSignOut}
            variant="destructive"
            disabled={isSigningOut}
            className="cursor-pointer"
          >
            <LogOut />
            {isSigningOut ? "Logging out..." : "Log out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
