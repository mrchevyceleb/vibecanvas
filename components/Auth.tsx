import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Brand } from "./Header";
export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [submitted, setSubmitted] = useState(false);
  const { login, signup, error, loading } = useAuth();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(false);
    const success = await (isLogin
      ? login(email.trim(), password)
      : signup(email.trim(), password));
    if (success) setSubmitted(true);
  };
  return (
    <div className="auth-page">
      <div className="auth-intro">
        <div className="brand">
          <Brand />
        </div>
        <p className="eyebrow">A SPACE FOR YOUR NEXT BIG IDEA</p>
        <h1>
          Imagine it.
          <br />
          Make it <span>real.</span>
        </h1>
        <p>
          From your first spark to your final frame.
          <br />
          Create images and videos with your favorite models, all in one
          workspace.
        </p>
        <div className="auth-models">
          <span>Nano Banana</span>
          <span>FLUX</span>
          <span>Kling</span>
          <span>Veo</span>
          <span>+ more</span>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="art-frame">
            <span className="art-sun" />
            <span className="art-hill one" />
            <span className="art-hill two" />
          </div>
        </div>
      </div>
      <div className="auth-form-wrap">
        <form className="auth-form panel" onSubmit={submit}>
          <p className="eyebrow">WELCOME TO VIBECANVAS</p>
          <h2>
            {isLogin ? "Good to see you again." : "Make room for your ideas."}
          </h2>
          <p className="muted">
            {isLogin
              ? "Sign in to your creative workspace."
              : "Create an account to save and organize your creations."}
          </p>
          <label htmlFor="email" className="field-label">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isLogin ? 1 : 6}
            required
            disabled={loading}
            placeholder={isLogin ? "Your password" : "At least 6 characters"}
          />
          {error && (
            <p className="inline-warning" role="alert">
              {error}
            </p>
          )}
          {submitted && !isLogin && (
            <p className="success-message" role="status">
              Check your email to confirm your account, then sign in.
            </p>
          )}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
            <span>↗</span>
          </button>
          <p className="auth-switch">
            {isLogin ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-link"
              disabled={loading}
              onClick={() => {
                setIsLogin(!isLogin);
                setSubmitted(false);
              }}
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
        <p className="auth-footnote">
          Your ideas, your library, your creative space.
        </p>
      </div>
    </div>
  );
};
