import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { QuizHub } from './pages/QuizHub';
import { ShieldAlert } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();

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

  // 2. Identity Gate: Unauthenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <Navbar />
        <main className="flex-1">
          <AuthPage />
        </main>
      </div>
    );
  }

  // 3. Identity Gate: Onboarding Required (missing role, CNIC, or name)
  const hasIncompleteProfile = !profile || !profile.role || !profile.cnic || !profile.name || profile.name.trim() === '';
  
  if (hasIncompleteProfile) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <Navbar />
        <main className="flex-1">
          <OnboardingPage />
        </main>
      </div>
    );
  }

  // 4. Role-based Dashboard Router
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Navbar />
      <main className="flex-1">
        {profile.role === 'Organizer' ? (
          <OrganizerDashboard />
        ) : (
          <QuizHub />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
