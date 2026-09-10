import { createContext, useEffect, useState } from "react";
import { User } from "../../api/models";
import { getUser } from "../../api/user-client";

interface UserContextType {
    user: User | null;
    isAdmin: boolean;
    isLoading: boolean;
    error: Error | null;
}

export const UserContext = createContext<UserContextType>({
    user: null,
    isAdmin: false,
    isLoading: true,
    error: null
});

interface UserContextProviderProps {
    children: React.ReactNode;
}

export const UserContextProvider: React.FC<UserContextProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const adminRole = import.meta.env.VITE_ADMIN_ROLE || "lhm-ab-mucgpt-admin";

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const userData = await getUser();
                setUser(userData);
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to fetch user data"));
                console.error("Failed to fetch user data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, []);

    const isAdmin = user?.roles?.includes(adminRole) ?? false;

    return <UserContext.Provider value={{ user, isAdmin, isLoading, error }}>{children}</UserContext.Provider>;
};

export default UserContextProvider;
