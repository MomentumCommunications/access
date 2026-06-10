import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

const steps = [
  { label: "Profile", href: "/register/profile" },
  { label: "Students", href: "/register/students" },
  { label: "Review", href: "/register/review" },
  { label: "Agreement", href: "/register/contract" },
] as const;

export function OnboardingShell() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeIndex = steps.findIndex((step) => pathname === step.href);
  const showProgress = activeIndex >= 0 || pathname === "/register/complete";
  const completed = pathname === "/register/complete";

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/register" className="flex items-center gap-3">
            <img
              src="/icons/icon-120x120.png"
              alt="Access Momentum"
              width={44}
              height={44}
              className="shrink-0 rounded-lg object-cover"
              style={{ width: 44, height: 44 }}
            />
            <span className="font-semibold">Access Momentum</span>
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground">
            Sign in
          </Link>
        </header>

        {showProgress ? (
          <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Registration">
            {steps.map((step, index) => {
              const isComplete = completed || index < activeIndex;
              const isActive = index === activeIndex;
              return (
                <li key={step.href} className="min-w-0">
                  <div
                    className={cn(
                      "mb-2 h-1 rounded-full bg-muted",
                      (isComplete || isActive) && "bg-primary",
                    )}
                  />
                  <div className="flex items-center gap-1.5">
                    {isComplete ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : null}
                    <span
                      className={cn(
                        "truncate text-xs text-muted-foreground sm:text-sm",
                        isActive && "font-medium text-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
