import { useConvexAction, useConvexQuery } from "@convex-dev/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { canAccessAdmin, canAccessStaff } from "~/lib/roles";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z.string().max(30, "Phone number must be 30 characters or fewer."),
  address: z.string().trim().min(1, "Address is required.").max(500),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileStep() {
  const navigate = useNavigate();
  const state = useConvexQuery(api.onboarding.getState, {});
  const saveProfile = useConvexAction(api.stripe.saveOnboardingProfile);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName:
        state?.user.firstName ||
        state?.user.name?.trim().split(/\s+/).slice(0, -1).join(" ") ||
        "",
      lastName:
        state?.user.lastName ||
        state?.user.name?.trim().split(/\s+/).slice(-1).join(" ") ||
        "",
      phone: state?.user.phone || "",
      address: state?.user.address || "",
    },
    mode: "onTouched",
  });
  const workforce = canAccessAdmin(state?.user) || canAccessStaff(state?.user);

  async function onSubmit(values: ProfileValues) {
    form.clearErrors("root");
    try {
      const result = await saveProfile(values);
      await navigate({ to: result.destination as never });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved.",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Your information</h1>
        <p className="mt-1 text-muted-foreground">
          {workforce
            ? "Confirm how your Access Momentum account should identify and contact you."
            : "Confirm how the studio should identify and contact you."}
        </p>
      </div>

      {state?.onboarding?.matchedImportedRecord ? (
        <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          We found your existing client record and filled in what we could.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{workforce ? "Account profile" : "Guardian or client"}</CardTitle>
          <CardDescription>
            Your account email is {String(state?.user.email || "")}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["firstName", "lastName"] as const).map((name) => (
                  <Controller
                    key={name}
                    name={name}
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={field.name}>
                          {name === "firstName" ? "First name" : "Last name"}
                        </FieldLabel>
                        <Input
                          {...field}
                          id={field.name}
                          autoComplete={
                            name === "firstName" ? "given-name" : "family-name"
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                ))}
              </div>
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="tel"
                      autoComplete="tel"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="address"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                    <Textarea
                      {...field}
                      id={field.name}
                      autoComplete="street-address"
                      aria-invalid={fieldState.invalid}
                      rows={3}
                    />
                    <FieldDescription>
                      Use your household mailing address. A separate billing
                      address can be added when you pay an invoice or save a
                      card on file.
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>

            {form.formState.errors.root?.message ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full sm:w-auto sm:float-right"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
