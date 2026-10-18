import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import EditorPage from "./pages/EditorPage";
import Header from "./components/Header";
import { Toaster } from "./components/ui/Toaster";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Auth } from "./components/Auth";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { session, initializing } = useAuth();
  if (initializing)
    return (
      <div className="loading-page" role="status">
        <div className="spinner" />
        <p>Opening your workspace…</p>
      </div>
    );

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-charcoal font-sans antialiased relative selection:bg-neon-cyan/30 selection:text-white">
      {/* Ambient Background Animation */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-neon-cyan/10 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-lime/10 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10">
        <a
          href="#main-content"
          className="skip-link"
          onClick={(event) => {
            event.preventDefault();
            const main = document.getElementById("main-content");
            main?.focus();
            main?.scrollIntoView();
          }}
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage key={`image-${session.user.id}`} mode="image" />
              }
            />
            <Route
              path="/video"
              element={
                <HomePage key={`video-${session.user.id}`} mode="video" />
              }
            />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/edit/:id" element={<EditorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </div>
  );
};

export default App;
