import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCurrentUser } from "~/hooks/useCurrentUser";
import {
  getDefaultActiveRole,
  getValidActiveRole,
  resolveUserRoles,
  type UserRole,
} from "~/lib/roles";

type ActiveRoleContextValue = {
  activeRole: UserRole;
  availableRoles: UserRole[];
  isReady: boolean;
  setActiveRole: (role: UserRole) => void;
};

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

function storageKey(userId: string) {
  return `access-active-role:${userId}`;
}

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const availableRoles = useMemo(() => resolveUserRoles(user), [user]);
  const [selectedRole, setSelectedRole] = useState<UserRole>(() =>
    getDefaultActiveRole(user),
  );
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const activeRole = getValidActiveRole(user, selectedRole);
  const isReady =
    !isLoading && (!user?._id || loadedUserId === user._id);

  useEffect(() => {
    if (!user?._id) {
      setSelectedRole(getDefaultActiveRole(user));
      setLoadedUserId(null);
      return;
    }

    const storedRole = window.localStorage.getItem(storageKey(user._id));
    const nextRole = getValidActiveRole(user, storedRole);
    setSelectedRole(nextRole);
    setLoadedUserId(user._id);
    window.localStorage.setItem(storageKey(user._id), nextRole);
  }, [user]);

  const setActiveRole = useCallback(
    (role: UserRole) => {
      if (!availableRoles.includes(role)) {
        return;
      }
      setSelectedRole(role);
      if (user?._id) {
        window.localStorage.setItem(storageKey(user._id), role);
      }
    },
    [availableRoles, user?._id],
  );

  const value = useMemo(
    () => ({ activeRole, availableRoles, isReady, setActiveRole }),
    [activeRole, availableRoles, isReady, setActiveRole],
  );

  return (
    <ActiveRoleContext.Provider value={value}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error("useActiveRole must be used within ActiveRoleProvider");
  }
  return context;
}
