import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  phone: z.string().max(30, "Phone number must be 30 characters or fewer."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileStep() {
  const navigate = useNavigate();
  const state = useConvexQuery(api.onboarding.getState, {});
  const saveProfile = useConvexMutation(api.onboarding.saveProfile);
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
    },
    mode: "onTouched",
  });

  async function onSubmit(values: ProfileValues) {
    form.clearErrors("root");
    try {
      await saveProfile(values);
      await navigate({ to: "/register/students" });
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
          Confirm how the studio should identify and contact you.
        </p>
      </div>

      {state?.onboarding?.matchedImportedRecord ? (
        <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
          We found your existing client record and filled in what we could.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Guardian or client</CardTitle>
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
