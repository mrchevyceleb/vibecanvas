
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const Auth: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, signup, error, loading } = useAuth();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            login(email, password);
        } else {
            signup(email, password);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-charcoal p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-2xl">
                <div className="text-center">
                    <img src="https://i.imgur.com/tGrFT8W.png" alt="VibeCanvas Logo" className="h-12 w-12 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-neon-cyan to-lime text-transparent bg-clip-text">Welcome to VibeCanvas</h1>
                    <p className="text-slate-400 mt-2">{isLogin ? "Sign in to continue" : "Create an account to get started"}</p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full p-3 bg-slate-900/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan border border-slate-700 transition-colors"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full p-3 bg-slate-900/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan border border-slate-700 transition-colors"
                    />
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-neon-cyan text-charcoal font-bold py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>
                <div className="text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-neon-cyan hover:underline">
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};
