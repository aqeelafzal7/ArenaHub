import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ShieldAlert, ArrowRight, Loader2, Search, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quiz } from '../types';

export const ParticipantDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    const fetchDiscoveredQuizzes = async () => {
      if (!profile?.cnic) {
        setLoading(false);
        return;
      }
      try {
        const cnicStr = profile.cnic.trim();
        const q = query(
          collection(db, 'quizzes'),
          where('allowedCnics', 'array-contains', cnicStr)
        );
        const snapshot = await getDocs(q);
        const fetchedQuizzes = snapshot.docs.map((doc) => doc.data() as Quiz);
        
        // Let's also check if user has cnic formatted with or without dashes
        const cnicClean = cnicStr.replace(/[-\s]/g, '');
        if (cnicStr !== cnicClean) {
            const q2 = query(
              collection(db, 'quizzes'),
              where('allowedCnics', 'array-contains', cnicClean)
            );
            const snap2 = await getDocs(q2);
            snap2.docs.forEach((doc) => {
               if (!fetchedQuizzes.find(fq => fq.id === doc.id)) {
                   fetchedQuizzes.push(doc.data() as Quiz);
               }
            });
        }
        setQuizzes(fetchedQuizzes);
      } catch (err) {
        console.error('Error fetching discovered quizzes', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiscoveredQuizzes();
  }, [profile]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || !selectedQuiz) return;
    setError(null);
    setJoinLoading(true);

    try {
      const quizData = selectedQuiz;
      
      if (quizData.joinCode && quizData.joinCode.toUpperCase() !== joinCode.trim().toUpperCase()) {
          setError('Invalid join code for this room.');
          setJoinLoading(false);
          return;
      }

      // Validation (Time)
      const start = quizData.openAt;
      const end = quizData.closeAt;
      const now = Date.now();
      if (start) {
        const startTime = new Date(start).getTime();
        if (now < startTime) {
          setError(`This room is not yet active. Starts at ${new Date(start).toLocaleString()}`);
          setJoinLoading(false);
          return;
        }
      }
      if (end) {
        const endTime = new Date(end).getTime();
        if (now > endTime) {
          setError('This room has expired.');
          setJoinLoading(false);
          return;
        }
      }

      // Route to pre-flight
      navigate(`/quiz/${selectedQuiz.id}/pre-flight`);
    } catch (err) {
      console.error(err);
      setError('An error occurred while validating the room. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-brand-text mb-2">Participant Dashboard</h1>
        <p className="text-brand-muted">Welcome, {profile?.name}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-brand-text flex items-center gap-2">
              <Search className="w-5 h-5 text-brand-primary" />
              Assigned Assessments
            </h2>
            {quizzes.length === 0 ? (
              <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center">
                <FileText className="w-12 h-12 text-brand-muted mx-auto mb-4" />
                <h3 className="text-brand-text font-bold mb-2">No Assessments Found</h3>
                <p className="text-brand-muted text-sm">We couldn't find any assessments matching your CNIC ({profile?.cnic || 'Not set'}). Make sure your CNIC in Settings matches what the organizer used.</p>
              </div>
            ) : (
              quizzes.map((quiz) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={quiz.id}
                  onClick={() => {
                    setSelectedQuiz(quiz);
                    setError(null);
                    setJoinCode('');
                  }}
                  className={`bg-brand-card border-2 cursor-pointer transition-all rounded-xl p-6 shadow-sm hover:shadow-md ${
                    selectedQuiz?.id === quiz.id
                      ? 'border-brand-primary'
                      : 'border-transparent hover:border-brand-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-brand-text text-lg mb-1">{quiz.title}</h3>
                      <p className="text-brand-muted text-sm flex items-center gap-2">
                         ID: {quiz.id.substring(0,8)}...
                      </p>
                    </div>
                    <div className="bg-brand-primary/10 text-brand-primary p-2 rounded-lg">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <AnimatePresence mode="wait">
            {selectedQuiz && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-brand-card border border-brand-border rounded-xl p-8 shadow-xl sticky top-24"
              >
                <div className="flex justify-center mb-6">
                  <div className="bg-brand-primary/10 p-4 rounded-full border border-brand-primary/20">
                    <ShieldAlert className="h-10 w-10 text-brand-primary" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-brand-text text-center tracking-tight mb-2">
                  Enter Join Code
                </h2>
                <p className="text-brand-muted text-center text-sm mb-8">
                  Please enter the 6-character code for <strong>{selectedQuiz.title}</strong> provided by your organizer.
                </p>

                <form onSubmit={handleJoin} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-2 uppercase tracking-wider text-center">
                      6-Character Code
                    </label>
                    <input
                      type="text"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABC123"
                      maxLength={6}
                      className="w-full px-4 py-4 bg-brand-bg border-2 border-brand-border rounded-xl text-brand-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors text-center font-mono text-2xl tracking-[0.25em]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg text-sm text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={joinLoading || joinCode.length < 3}
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-4 px-4 rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-50"
                  >
                    {joinLoading ? (
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
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
