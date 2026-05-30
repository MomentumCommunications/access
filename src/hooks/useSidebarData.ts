import { useCurrentUser } from "./useCurrentUser";

export function useSidebarData() {
  const { data: convexUser, isLoading: isUserLoading } = useCurrentUser();

  return {
    convexUser,
    isUserLoading,
    isLoading: isUserLoading,
  };
}
