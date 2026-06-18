import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "~/components/ui/button";

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100svh-54px)] flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-7xl font-bold tracking-tight text-primary">404</p>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">This page wandered off</h1>
          <div className="text-pretty text-muted-foreground">
            {children || (
              <p>
                We couldn&apos;t find what you were looking for. It may have
                moved, or the link may be out of date.
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft />
            Go Back
          </Button>
          <Button asChild>
            <Link to="/home">
              <Home />
              Return Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
