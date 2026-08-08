import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Quiz } from '../types';

export const ParticipantDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    setError(null);
    setLoading(true);

    try {
      // Assuming roomId corresponds to quizId
      const quizDoc = await getDoc(doc(db, 'quizzes', roomId.trim()));
      
      if (!quizDoc.exists()) {
        // Fallback: Check if it's a hub (as user said "Hub ID"). If so, we might need to find the active quiz.
        const hubDoc = await getDoc(doc(db, 'hubs', roomId.trim()));
        if (hubDoc.exists()) {
           setError('You entered a Hub ID. Please enter the specific Quiz Room ID provided by your Organizer.');
        } else {
           setError('No Quiz Room found with this ID code.');
        }
        setLoading(false);
        return;
      }

      const quizData = quizDoc.data() as Quiz;
      
      // Validation 1 (CNIC)
      const allowedCnicsArray = quizData.allowedCnics || (quizData as any).allowedCNICs || [];
      if (allowedCnicsArray.length > 0) {
        const userCnicClean = (profile?.cnic || '').trim().replace(/[-\s]/g, '');
        const isAllowed = allowedCnicsArray.some(
          (cnic: string) => cnic.trim().replace(/[-\s]/g, '') === userCnicClean
        );
        if (!isAllowed) {
          setError('Your CNIC is not authorized for this Quiz Room.');
          setLoading(false);
          return;
        }
      }

      // Validation 2 (Time)
      const start = quizData.openAt || (quizData as any).startTime;
      const end = quizData.closeAt || (quizData as any).endTime;
      const now = Date.now();

      if (start) {
        const startTime = new Date(start).getTime();
        if (now < startTime) {
          setError(`This room is not yet active. Starts at ${new Date(start).toLocaleString()}`);
          setLoading(false);
          return;
        }
      }

      if (end) {
        const endTime = new Date(end).getTime();
        if (now > endTime) {
          setError('This room has expired.');
          setLoading(false);
          return;
        }
      }

      // Both pass, route to pre-flight
      navigate(`/quiz/${quizDoc.id}/pre-flight`);
    } catch (err) {
      console.error(err);
      setError('An error occurred while validating the room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-xl"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-brand-primary/10 p-4 rounded-full border border-brand-primary/20">
            <ShieldAlert className="h-10 w-10 text-brand-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-brand-text text-center tracking-tight mb-2">Join Room</h2>
        <p className="text-brand-muted text-center text-sm mb-8">Enter your Quiz Room ID to start the verification process.</p>
        
        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-brand-text mb-2 uppercase tracking-wider">
              Room ID
            </label>
            <input
              type="text"
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. QZ-12345"
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors text-center font-mono text-lg"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !roomId.trim()}
            className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-3.5 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue to Pre-Flight
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
