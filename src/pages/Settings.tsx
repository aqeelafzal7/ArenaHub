import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { Save, AlertOctagon, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export const Settings: React.FC = () => {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [cnic, setCnic] = useState(profile?.cnic || '');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 5) value = value.slice(0, 5) + '-' + value.slice(5);
    if (value.length > 13) value = value.slice(0, 13) + '-' + value.slice(13, 14);
    setCnic(value);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setError('');
    setMessage('');
    
    if (cnic && !cnicRegex.test(cnic)) {
      setError('Invalid CNIC Format (XXXXX-XXXXXXX-X)');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update Firestore Profile
      const updates: any = {};
      if (name !== profile.name) updates.name = name;
      if (cnic !== profile.cnic) updates.cnic = cnic;
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', user.uid), updates);
      }
      
      // Update Password if provided
      if (password) {
        if (password.length < 6) {
           setError('Password must be at least 6 characters.');
           setLoading(false);
           return;
        }
        await updatePassword(user, password);
        setPassword('');
      }
      
      setMessage('Settings updated successfully.');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Please log out and log back in to change your password.');
      } else {
        setError('Failed to update settings. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-xl"
      >
        <h2 className="text-2xl font-black text-brand-text mb-6">Account Settings</h2>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl flex items-center gap-3 text-sm">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        
        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <p>{message}</p>
          </div>
        )}
        
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-brand-text mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:ring-2 focus:ring-brand-primary outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-brand-text mb-2">CNIC Number</label>
            <input
              type="text"
              value={cnic}
              onChange={handleCnicChange}
              placeholder="12345-1234567-1"
              required
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:ring-2 focus:ring-brand-primary outline-none transition-all font-mono"
            />
          </div>
          
          <div className="pt-6 mt-6 border-t border-brand-border">
            <label className="block text-sm font-bold text-brand-text mb-2">Change Password</label>
            <p className="text-xs text-brand-muted mb-4">Leave blank to keep your current password.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:ring-2 focus:ring-brand-primary outline-none transition-all"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-3.5 rounded-lg hover:bg-opacity-90 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Save Changes
          </button>
        </form>
      </motion.div>
    </div>
  );
};
