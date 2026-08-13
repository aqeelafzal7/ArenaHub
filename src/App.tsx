import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { Footer } from "./components/Footer";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OrganizerDashboard } from "./pages/OrganizerDashboard";
import { ParticipantDashboard } from "./pages/ParticipantDashboard";
import { PreFlight } from "./pages/PreFlight";
import { QuizSession } from "./pages/QuizSession";
import { SuperAdminDashboard } from "./pages/SuperAdminDashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PwaGateway } from "./components/PwaGateway";
import { ShieldAlert } from "lucide-react";

import { Settings } from "./pages/Settings";

const AppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { user, profile, loading, isQuizStarted } = useAuth();

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
          <ShieldAlert className="h-6 w-6 text-brand-primary absolute" />
        </div>
        <p className="text-sm font-extrabold text-brand-text mt-4 animate-pulse">
          ArenaHub Syncing...
        </p>
      </div>
    );
  }

  // 2. Identity Gate: Onboarding Required
  const hasIncompleteProfile =
    user &&
    (!profile ||
      !profile.role ||
      !profile.cnic ||
      !profile.name ||
      profile.name.trim() === "");

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {!isQuizStarted && <Navbar onMenuClick={() => setIsSidebarOpen(true)} />}

      <div className="flex flex-1 overflow-hidden">
        {!isQuizStarted && user && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Public / Auth Route */}
            <Route
              path="/login"
              element={!user ? <AuthPage /> : <Navigate to="/" replace />}
            />

            {/* Onboarding Route */}
            <Route
              path="/onboarding"
              element={
                user && hasIncompleteProfile ? (
                  <OnboardingPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            {/* Home Route - Redirects based on role or goes to Participant dashboard */}
            <Route
              path="/"
              element={
                !user ? (
                  <Navigate to="/login" replace />
                ) : hasIncompleteProfile ? (
                  <Navigate to="/onboarding" replace />
                ) : ["admin", "super_admin", "Organizer"].includes(
                    profile?.role || "",
                  ) ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <PwaGateway>
                    <ParticipantDashboard />
                  </PwaGateway>
                )
              }
            />

            {/* Admin Dashboard */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "super_admin", "Organizer"]}
                >
                  <OrganizerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Obscured Super Admin Panel */}
            <Route
              path="/sys-core-panel-x9v2"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* PreFlight and Quiz Session */}
            <Route
              path="/quiz/:id/pre-flight"
              element={
                <ProtectedRoute>
                  <PwaGateway>
                    <PreFlight />
                  </PwaGateway>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:id/session"
              element={
                <ProtectedRoute>
                  <PwaGateway>
                    <QuizSession />
                  </PwaGateway>
                </ProtectedRoute>
              }
            />
            
            {/* Settings */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/unauthorized"
              element={
                <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                  <div className="p-8 text-center bg-brand-surface border border-red-500 rounded-xl shadow-lg max-w-md w-full">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">
                      Access Denied
                    </h1>
                    <p className="text-brand-text">
                      You are not authorized to view this page.
                    </p>
                  </div>
                </div>
              }
            />

            {/* Catch-all route to prevent probing */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
      {!isQuizStarted && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
