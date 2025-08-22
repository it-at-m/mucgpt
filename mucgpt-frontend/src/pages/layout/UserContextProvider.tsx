import { createContext, useEffect, useState } from "react";
import { User } from "../../api/models";
import { getUser } from "../../api/user-client";

interface UserContextType {
    user: User | null;
    isLoading: boolean;
    error: Error | null;
}

export const UserContext = createContext<UserContextType>({
    user: null,
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

    return <UserContext.Provider value={{ user, isLoading, error }}>{children}</UserContext.Provider>;
};

export default UserContextProvider;
