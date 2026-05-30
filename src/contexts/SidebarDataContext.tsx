import { createContext, useContext, ReactNode, useMemo } from "react";
import { Doc } from "convex/_generated/dataModel";
import { useSidebarData } from "~/hooks/useSidebarData";

interface SidebarDataContextType {
  convexUser?: Doc<"users"> | null;
  isLoading: boolean;
  isUserLoading: boolean;
}

const SidebarDataContext = createContext<SidebarDataContextType | null>(null);

export function SidebarDataProvider({ children }: { children: ReactNode }) {
  const sidebarData = useSidebarData();

  const contextValue = useMemo(() => {
    return {
      ...sidebarData,
    };
  }, [sidebarData.convexUser?._id, sidebarData.isLoading]);

  return (
    <SidebarDataContext.Provider value={contextValue}>
      {children}
    </SidebarDataContext.Provider>
  );
}

export function useSidebarDataContext() {
  const context = useContext(SidebarDataContext);
  if (!context) {
    throw new Error(
      "useSidebarDataContext must be used within a SidebarDataProvider",
    );
  }
  return context;
}
