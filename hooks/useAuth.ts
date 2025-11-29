// FIX: Import React to support JSX syntax and React types like React.FC.
import React, { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react';
import { supabase } from '../supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
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
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
            }
        );

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, []);

    const executeAuthAction = async (action: () => Promise<any>) => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await action();
            if (error) throw error;
        } catch (err: any) {
            setError(err.error_description || err.message);
        } finally {
            setLoading(false);
        }
    };

    const login = (email: string, password: string) =>
        executeAuthAction(() => supabase.auth.signInWithPassword({ email, password }));

    const signup = (email: string, password: string) =>
        executeAuthAction(() => supabase.auth.signUp({ email, password }));

    const logout = () =>
        executeAuthAction(() => supabase.auth.signOut());

    const value = { session, user, loading, error, login, signup, logout };

    // FIX: Replaced JSX with React.createElement to be compatible with a .ts file extension, which cannot parse JSX.
    return React.createElement(AuthContext.Provider, { value }, !loading && children);
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
