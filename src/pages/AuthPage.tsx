import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, ShieldCheck, Mail, Lock, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';

export const AuthPage: React.FC = () => {
  const { signInWithGoogle, signUpWithEmail, loginWithEmail } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name');
        }
        await signUpWithEmail(email, password, name);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google Auth failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full shadow-lg"
      >
        {/* Banner */}
        <div className="text-center mb-8">
          <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-full inline-flex items-center justify-center mb-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-text">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-sm text-brand-muted mt-1">
            Access secure, multi-tenant interactive quizzes
          </p>
        </div>

        {/* Auth Method Toggles */}
        <div className="flex bg-brand-bg rounded-lg p-1 border border-brand-border mb-6">
          <button
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              isLogin ? 'bg-brand-primary text-white shadow-xs' : 'text-brand-muted hover:text-brand-text'
            }`}
            id="auth-toggle-login"
          >
            <LogIn className="h-4 w-4" />
            Log In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              !isLogin ? 'bg-brand-primary text-white shadow-xs' : 'text-brand-muted hover:text-brand-text'
            }`}
            id="auth-toggle-register"
          >
            <UserPlus className="h-4 w-4" />
            Register
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                  <UserIcon className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all text-sm"
                  id="auth-name-input"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-brand-bg border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all text-sm"
                id="auth-email-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-text mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-muted">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-bg border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none transition-all text-sm"
                id="auth-pass-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold text-sm tracking-wide hover:bg-opacity-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs mt-2"
            id="auth-submit-btn"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-brand-card px-3 text-brand-muted font-semibold">Or continue with</span>
          </div>
        </div>

        {/* Google Authentication */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border border-brand-border hover:bg-slate-50 text-slate-800 font-bold py-2.5 px-4 rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          id="auth-google-btn"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.737-.08-1.3-.176-1.852H12.24z"
            />
          </svg>
          Google Single Sign-On
        </button>
      </motion.div>
    </div>
  );
};
