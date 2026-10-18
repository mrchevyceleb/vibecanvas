import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FolderIcon, HomeIcon } from "./ui/Icons";
export const Brand = () => (
  <>
    <span className="brand-mark" aria-hidden="true">
      v<span>c</span>
    </span>
    <span className="brand-name">
      vibe<span>canvas</span>
    </span>
  </>
);
const Header: React.FC = () => {
  const { logout, user, loading } = useAuth();
  return (
    <header className="app-header">
      <NavLink to="/" className="brand" aria-label="VibeCanvas home">
        <Brand />
      </NavLink>
      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end>
          <HomeIcon />
          <span>Images</span>
        </NavLink>
        <NavLink to="/video">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="3" y="5" width="13" height="14" rx="3" />
            <path d="m16 9 5-3v12l-5-3" />
          </svg>
          <span>Video</span>
        </NavLink>
        <NavLink to="/library">
          <FolderIcon />
          <span>Library</span>
        </NavLink>
      </nav>
      <div className="account">
        <span className="avatar" title={user?.email}>
          {user?.email?.[0]?.toUpperCase() || "V"}
        </span>
        <button className="quiet-button" onClick={logout} disabled={loading}>
          Sign out
        </button>
      </div>
    </header>
  );
};
export default Header;
