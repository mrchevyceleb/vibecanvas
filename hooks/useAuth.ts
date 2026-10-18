// FIX: Import React to support JSX syntax and React types like React.FC.
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  PropsWithChildren,
} from "react";
import { supabase } from "../supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useLibraryStore } from "../store/useLibraryStore";
import { useGenerationStore } from "../store/useGenerationStore";
import { useTemplatesStore } from "../store/useTemplatesStore";
import { toast } from "../components/ui/Toaster";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error);
      } else {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }
      setLoading(false);
      setInitializing(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    useLibraryStore.setState({
      imageRecords: [],
      folders: [],
      loading: false,
      ownerId: user?.id || null,
      cleanupPending: false,
    });
    useTemplatesStore.setState({
      templates: [],
      loading: false,
      ownerId: user?.id || null,
    });
    useGenerationStore.getState().reset();
  }, [user?.id]);

  const executeAuthAction = async (action: () => Promise<any>) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await action();
      if (error) throw error;
      return true;
    } catch (err: any) {
      setError(err.error_description || err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = (email: string, password: string) =>
    executeAuthAction(() =>
      supabase.auth.signInWithPassword({ email, password }),
    );

  const signup = (email: string, password: string) =>
    executeAuthAction(() => supabase.auth.signUp({ email, password }));

  const logout = async () => {
    const success = await executeAuthAction(() => supabase.auth.signOut());
    if (!success) toast("Sign out failed. Please try again.", "error");
    return success;
  };

  const value = {
    session,
    user,
    loading,
    initializing,
    error,
    login,
    signup,
    logout,
  };

  // FIX: Replaced JSX with React.createElement to be compatible with a .ts file extension, which cannot parse JSX.
  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
