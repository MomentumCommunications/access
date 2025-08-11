import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useUser } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/")({
  component: PublicHome,
});

function PublicHome() {
  const user = useUser();

  // If user is signed in, redirect to home
  if (user.isLoaded && user.isSignedIn) {
    return <Navigate to="/home" replace />;
  }

  // If user is not signed in, redirect to sign-in
  if (user.isLoaded && !user.isSignedIn) {
    return <Navigate to="/sign-in/$" replace />;
  }

  // Loading state
  return (
    <div className="flex h-screen flex-col gap-12 justify-center items-center">
      <div className="animate-pulse text-center">Loading...</div>
    </div>
  );
}

