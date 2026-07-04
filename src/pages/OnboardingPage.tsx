import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ClipboardSignature, UserCheck, CreditCard, User } from 'lucide-react';
import { motion } from 'motion/react';
import { UserRole } from '../types';

export const OnboardingPage: React.FC = () => {
  const { user, onboardUser } = useAuth();
  
  const [name, setName] = useState(user?.displayName || '');
  const [role, setRole] = useState<UserRole | null>(null);
  const [cnic, setCnic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-format CNIC input to XXXXX-XXXXXXX-X
  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digits = val.replace(/\D/g, '').substring(0, 13);
    
    let formatted = '';
    if (digits.length > 0) {
      formatted += digits.substring(0, 5);
    }
    if (digits.length > 5) {
      formatted += '-' + digits.substring(5, 12);
    }
    if (digits.length > 12) {
      formatted += '-' + digits.substring(12, 13);
    }
    
    setCnic(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!role) {
      setError('Please select your platform role.');
      return;
    }

    // Validate 15-character CNIC format: XXXXX-XXXXXXX-X (13 digits + 2 hyphens)
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic)) {
      setError('Please input a valid 15-digit CNIC (Format: XXXXX-XXXXXXX-X).');
      return;
    }

    setLoading(true);
    try {
      await onboardUser(role, cnic, name);
    } catch (err: any) {
      setError(err.message || 'Onboarding registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg w-full shadow-lg"
      >
        <div className="text-center mb-8">
          <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-full inline-flex items-center justify-center mb-3">
            <ClipboardSignature className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-text" id="onboard-title">Account Onboarding</h2>
          <p className="text-sm text-brand-muted mt-1">
            Complete your profile identification to secure your portal access.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" id="onboard-form">
          
          {/* Full Name Input */}
          <div>
            <label className="block text-sm font-bold text-brand-text mb-1">
              Full Name
            </label>
            <p className="text-xs text-brand-muted mb-2">
              Provide your official name for identification purposes.
            </p>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                <User className="h-5 w-5" />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., Muhammad Ali"
                className="w-full bg-brand-bg border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all text-sm font-medium"
                id="onboard-name-input"
              />
            </div>
          </div>

          {/* Role Selection cards */}
          <div>
            <label className="block text-sm font-bold text-brand-text mb-3">
              Select Your Platform Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Organizer Choice */}
              <div
                onClick={() => setRole('Organizer')}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                  role === 'Organizer'
                    ? 'border-brand-primary bg-brand-primary/5 shadow-xs'
                    : 'border-brand-border hover:border-brand-primary/50 hover:bg-brand-bg'
                }`}
                id="onboard-role-organizer"
              >
                <Users className={`h-8 w-8 ${role === 'Organizer' ? 'text-brand-primary' : 'text-brand-muted'}`} />
                <span className="font-bold text-sm text-brand-text">Organizer (Admin)</span>
                <span className="text-xs text-brand-muted">
                  Create hubs, customize branding logos, publish quizzes, and watch live proctoring.
                </span>
              </div>

              {/* Participant Choice */}
              <div
                onClick={() => setRole('Participant')}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                  role === 'Participant'
                    ? 'border-brand-primary bg-brand-primary/5 shadow-xs'
                    : 'border-brand-border hover:border-brand-primary/50 hover:bg-brand-bg'
                }`}
                id="onboard-role-participant"
              >
                <UserCheck className={`h-8 w-8 ${role === 'Participant' ? 'text-brand-primary' : 'text-brand-muted'}`} />
                <span className="font-bold text-sm text-brand-text">Participant</span>
                <span className="text-xs text-brand-muted">
                  Join quiz competitions, view immediate scores, and access live proctored arenas.
                </span>
              </div>

            </div>
          </div>

          {/* CNIC Input */}
          <div>
            <label className="block text-sm font-bold text-brand-text mb-1">
              National CNIC / Identity Number
            </label>
            <p className="text-xs text-brand-muted mb-2">
              Required for state identification and secure verification.
            </p>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                <CreditCard className="h-5 w-5" />
              </span>
              <input
                type="text"
                required
                value={cnic}
                onChange={handleCnicChange}
                placeholder="XXXXX-XXXXXXX-X"
                className="w-full bg-brand-bg border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all text-sm font-mono tracking-widest"
                id="onboard-cnic-input"
              />
            </div>
            <p className="text-xs text-brand-muted mt-1.5 font-medium">
              E.g., 35201-1234567-9 (15-character string auto-formatted)
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !role}
            className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold text-sm tracking-wide hover:bg-opacity-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            id="onboard-submit-btn"
          >
            {loading ? 'Registering Info...' : 'Complete Onboarding'}
          </button>

        </form>
      </motion.div>
    </div>
  );
};
