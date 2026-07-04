import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Sun, Moon, Eye, ShieldAlert } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, logout, theme, setTheme } = useAuth();

  return (
    <nav className="bg-brand-card border-b border-brand-border px-6 py-4 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-lg text-white shadow-sm flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" id="nav-brand-logo" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-brand-text">ArenaHub</span>
            <span className="text-xs block text-brand-muted font-medium">SaaS Multi-Tenant Quiz Platform</span>
          </div>
        </div>

        {/* User Info & Preferences */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          
          {/* Theme Selector */}
          <div className="bg-brand-bg rounded-lg p-1 border border-brand-border flex items-center gap-1">
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-brand-primary text-white shadow-xs' : 'text-brand-muted hover:text-brand-text'}`}
              title="Light Mode"
              id="theme-light-btn"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-brand-primary text-white shadow-xs' : 'text-brand-muted hover:text-brand-text'}`}
              title="Dark Mode"
              id="theme-dark-btn"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme('colorblind')}
              className={`p-1.5 rounded-md transition-all ${theme === 'colorblind' ? 'bg-brand-primary text-white shadow-xs' : 'text-brand-muted hover:text-brand-text'}`}
              title="Color-Blind Supportive Theme"
              id="theme-colorblind-btn"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>

          {/* User Status */}
          {user && (
            <div className="flex items-center gap-3 border-l border-brand-border pl-4">
              <div className="text-right hidden md:block">
                <span className="text-sm font-semibold block text-brand-text">
                  {user.displayName || user.email}
                </span>
                {profile && (
                  <span className={`text-xs inline-block px-2 py-0.5 rounded-full font-bold ${
                    profile.role === 'Organizer' 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-green-100 text-green-800 border border-green-200'
                  }`}>
                    {profile.role}
                  </span>
                )}
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg border border-red-200 transition-colors"
                title="Log Out"
                id="logout-btn"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
