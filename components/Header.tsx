import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import ModelSwitcher from './ModelSwitcher';
import TemplatePicker from './TemplatePicker';
import { useAuth } from '../hooks/useAuth';
import { MenuIcon, CloseIcon, HomeIcon, FolderIcon, UploadIcon } from './ui/Icons';
import { cn } from '../lib/utils';

const Header: React.FC = () => {
    const activeLinkClass = "text-white bg-white/10";
    const inactiveLinkClass = "text-gray-400 hover:text-white hover:bg-white/5";
    const { logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-lg">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
                    
                    {/* Left: Logo */}
                    <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
                        <img src="https://i.imgur.com/tGrFT8W.png" alt="VibeCanvas Logo" className="h-8 w-8" />
                        <span className="hidden md:inline-block font-bold text-lg bg-gradient-to-r from-neon-cyan to-lime text-transparent bg-clip-text">VibeCanvas</span>
                    </NavLink>

                    {/* Middle (Desktop): Navigation */}
                    <nav className="hidden md:flex gap-2">
                        <NavLink to="/" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}>
                            <HomeIcon /> Image
                        </NavLink>
                        <NavLink to="/video" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}>
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                             Video
                        </NavLink>
                        <NavLink to="/library" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}>
                            <FolderIcon /> Library
                        </NavLink>
                    </nav>

                    {/* Middle (Mobile): Flexible Model Switcher */}
                    <div className="flex md:hidden flex-1 min-w-0 max-w-[240px]">
                        <ModelSwitcher />
                    </div>

                    {/* Right: Controls & Profile */}
                    <div className="flex items-center gap-3">
                        <div className="hidden md:block w-44">
                            <TemplatePicker />
                        </div>
                        <div className="hidden md:block w-44">
                            <ModelSwitcher />
                        </div>
                        
                        {/* Desktop Logout */}
                        <button onClick={logout} className="hidden md:flex px-3 py-2 text-sm text-gray-300 hover:bg-slate-700/50 rounded-md transition-colors items-center gap-2">
                            <span>Logout</span>
                        </button>

                        {/* Mobile Menu Button */}
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay - Rendered via Portal to ensure it stays on top of everything */}
            {isMobileMenuOpen && createPortal(
                <div className="fixed inset-0 top-16 z-50 w-full bg-charcoal/95 backdrop-blur-xl border-t border-white/10 p-4 flex flex-col gap-4 animate-fade-in md:hidden overflow-y-auto pb-20">
                    <nav className="flex flex-col gap-2">
                            <NavLink to="/" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-4 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-3`}>
                            <HomeIcon /> Image
                        </NavLink>
                         <NavLink to="/video" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-4 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-3`}>
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                             Video
                        </NavLink>
                        <NavLink to="/library" className={({ isActive }) => `${isActive ? activeLinkClass : inactiveLinkClass} px-4 py-3 rounded-xl text-base font-medium transition-colors flex items-center gap-3`}>
                            <FolderIcon /> Library
                        </NavLink>
                    </nav>
                    <div className="h-[1px] bg-white/10 w-full my-1"></div>
                    
                    <div className="flex flex-col gap-2">
                            <span className="text-xs text-gray-500 px-2 uppercase tracking-wider font-semibold">Template</span>
                        <TemplatePicker />
                    </div>

                    <div className="h-[1px] bg-white/10 w-full my-1"></div>
                    
                    <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-base font-medium">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                            Logout
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};

export default Header;