import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  arrayUnion, 
  serverTimestamp 
} from 'firebase/firestore';
import { useProctoring } from '../hooks/useProctoring';
import { Hub, Quiz, Question, Attempt } from '../types';
import { 
  ShieldAlert, 
  Timer, 
  CheckCircle, 
  AlertOctagon, 
  ArrowRight, 
  Lock, 
  X, 
  CornerDownLeft, 
  BookOpen 
} from 'lucide-react';
import { motion } from 'motion/react';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const QuizHub: React.FC = () => {
  const { user, profile, theme, isQuizStarted, setIsQuizStarted } = useAuth();
  const isColorblind = theme === 'colorblind';

  // Search/Access States
  const [hubIdInput, setHubIdInput] = useState('');
  const [quizIdInput, setQuizIdInput] = useState('');
  
  const [activeHub, setActiveHub] = useState<Hub | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);

  // Access Blocked States
  const [isWhitelistBlocked, setIsWhitelistBlocked] = useState(false);
  const [isAttemptsExhausted, setIsAttemptsExhausted] = useState(false);

  // Taking States
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [qId: string]: number }>({});
  
  // Timer States
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);
  const cheatFlagsRef = useRef<string[]>([]);

  // Proctoring Alert Modal States
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningModalMessage, setWarningModalMessage] = useState('');
  const [isQuestionMutationsLocked, setIsQuestionMutationsLocked] = useState(false);

  // Result States
  const [finalAttempt, setFinalAttempt] = useState<Attempt | null>(null);

  // Feedback/Loading States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Hub branding
  const handleLoadHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const targetHubId = hubIdInput.trim();
    const path = `hubs/${targetHubId}`;
    try {
      const docSnap = await getDoc(doc(db, 'hubs', targetHubId));
      if (docSnap.exists()) {
        setActiveHub(docSnap.data() as Hub);
      } else {
        setError('No organization Hub found with this ID code.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get quiz schedule
  const getQuizSchedule = (quiz: Quiz) => {
    const start = quiz.openAt || (quiz as any).startTime;
    const end = quiz.closeAt || (quiz as any).endTime;
    return { start, end };
  };

  // Helper to determine if current time is outside window
  const isOutsideTimeWindow = (quiz: Quiz) => {
    const { start, end } = getQuizSchedule(quiz);
    const now = Date.now();
    if (start) {
      const startTime = new Date(start).getTime();
      if (now < startTime) return 'BEFORE';
    }
    if (end) {
      const endTime = new Date(end).getTime();
      if (now > endTime) return 'AFTER';
    }
    return null; // within window
  };

  // 2. Fetch Quiz and questions
  const handleLoadQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHub) return;
    setError(null);
    setIsWhitelistBlocked(false);
    setIsAttemptsExhausted(false);
    setLoading(true);

    const targetQuizId = quizIdInput.trim();
    const path = `quizzes/${targetQuizId}`;
    try {
      const quizDoc = await getDoc(doc(db, 'quizzes', targetQuizId));
      if (quizDoc.exists()) {
        const quizData = quizDoc.data() as Quiz;
        
        // Ensure the quiz belongs to the loaded Hub
        if (quizData.hubId !== activeHub.id) {
          setError('This quiz code does not belong to the active Hub portal.');
          setLoading(false);
          return;
        }

        if (!quizData.isActive) {
          setError('This quiz is currently in draft/inactive mode.');
          setLoading(false);
          return;
        }

        // Allowed CNIC White-list Validation (Supporting allowedCNICs and allowedCnics)
        const allowedCnicsArray = quizData.allowedCnics || (quizData as any).allowedCNICs;
        const isWhitelistActive = Array.isArray(allowedCnicsArray) && allowedCnicsArray.length > 0;

        if (isWhitelistActive) {
          const userCnicClean = (profile?.cnic || '').trim().replace(/[-\s]/g, '');
          const isAllowed = allowedCnicsArray.some(
            (cnic: string) => cnic.trim().replace(/[-\s]/g, '') === userCnicClean
          );
          if (!isAllowed) {
            setIsWhitelistBlocked(true);
            setError('Access Blocked: Your registered CNIC is not whitelisted for this competitive quiz environment.');
            setLoading(false);
            return;
          }
        }

        // Attempt Limit Validation (Supporting maxAttempts and totalAttemptsAllowed)
        if (user) {
          const attemptsQuery = query(
            collection(db, 'attempts'),
            where('userId', '==', user.uid),
            where('quizId', '==', targetQuizId)
          );
          const attemptsSnap = await getDocs(attemptsQuery);
          const maxAttemptsCap = quizData.totalAttemptsAllowed ?? (quizData as any).maxAttempts ?? 1;
          
          if (attemptsSnap.size >= maxAttemptsCap) {
            setIsAttemptsExhausted(true);
            setError(`Room Ingestion Blocked: You have already exhausted your ${attemptsSnap.size}/${maxAttemptsCap} allowed attempts.`);
            setLoading(false);
            return;
          }
        }

        setActiveQuiz(quizData);

        // Fetch questions pool
        const qQuery = query(collection(db, 'questions'), where('quizId', '==', targetQuizId));
        const questionsSnap = await getDocs(qQuery);
        const qList: Question[] = [];
        questionsSnap.forEach((docSnap) => {
          qList.push(docSnap.data() as Question);
        });
        
        setQuizQuestions(qList);
        if (qList.length === 0) {
          setError('This quiz has no active questions loaded in the pool.');
        }
      } else {
        setError('Invalid quiz code. Please verify and re-try.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  // 3. Start Proctored Quiz
  const handleStartQuiz = async () => {
    if (!user || !profile || !activeQuiz || !activeHub || quizQuestions.length === 0) return;
    setError(null);

    setLoading(true);

    const attemptId = doc(collection(db, 'attempts')).id;
    const path = `attempts/${attemptId}`;

    const newAttempt: Attempt = {
      id: attemptId,
      hubId: activeHub.id,
      quizId: activeQuiz.id,
      userId: user.uid,
      userName: profile.name,
      userCnic: profile.cnic,
      userEmail: user.email || '',
      score: 0,
      timeSpentSeconds: 0,
      passed: false,
      cheatFlags: [],
      status: 'In Progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Write the initial attempt record to Firestore
      await setDoc(doc(db, 'attempts', attemptId), {
        ...newAttempt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setActiveAttemptId(attemptId);
      setTimeLeft(activeQuiz.timeLimit * 60);
      setIsQuizStarted(true);
      setCurrentQuestionIdx(0);
      setAnswers({});
      cheatFlagsRef.current = [];
      isSubmittingRef.current = false;
      setIsQuestionMutationsLocked(false);
      setWarningModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize proctored session.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Timer effect & Scheduled window breach check
  useEffect(() => {
    if (!isQuizStarted || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      // Monitor if closeAt / endTime is breached in real-time
      if (activeQuiz) {
        const { end } = getQuizSchedule(activeQuiz);
        if (end) {
          const endTime = new Date(end).getTime();
          if (Date.now() >= endTime) {
            clearInterval(timerRef.current!);
            setIsQuestionMutationsLocked(true);
            setWarningModalMessage('CRITICAL SCHEDULE WINDOW BREACH: The quiz closed time has been reached. Lock down initiated. Your answers are being auto-submitted.');
            setWarningModalOpen(true);
            handleSubmitQuiz('Timer Expired');
            return;
          }
        }
      }

      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto submit on time-out
          handleSubmitQuiz('Timer Expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isQuizStarted, timeLeft, activeQuiz]);

  // 5. Proctoring Logger Callbacks
  const logCheatFlag = async (flag: string) => {
    cheatFlagsRef.current.push(flag);
    if (!activeAttemptId) return;
    const path = `attempts/${activeAttemptId}`;
    try {
      await updateDoc(doc(db, 'attempts', activeAttemptId), {
        cheatFlags: arrayUnion(flag),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to log proctoring alert to Firestore:', err);
    }
  };

  const handleProctoringAutoSubmit = async (reason: string) => {
    setIsQuestionMutationsLocked(true);
    setWarningModalMessage(`PROCTORING LOCKOUT: ${reason}. Your quiz has been auto-submitted due to a security violation.`);
    setWarningModalOpen(true);
    await handleSubmitQuiz('Locked Out', true);
  };

  // Mount strict proctoring hook
  useProctoring({
    active: isQuizStarted,
    onCheatFlag: logCheatFlag,
    onAutoSubmit: handleProctoringAutoSubmit,
    onShowWarningModal: (msg) => {
      setWarningModalMessage(msg);
      setWarningModalOpen(true);
    }
  });

  // Dismiss Warning Modal
  const handleDismissWarning = () => {
    setWarningModalOpen(false);
  };

  // 6. Submit Quiz Handler
  const handleSubmitQuiz = async (reason: 'Submitted' | 'Timer Expired' | 'Locked Out', forceLockout = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      if (!activeAttemptId || !activeQuiz || quizQuestions.length === 0) {
        return;
      }
      setLoading(true);
      setError(null);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Compute raw score
      let correctCount = 0;
      quizQuestions.forEach((q) => {
        const selected = answers[q.id];
        if (selected !== undefined && selected === q.correctOption) {
          correctCount++;
        }
      });

      const finalScore = correctCount;
      const finalPercentage = (correctCount / quizQuestions.length) * 100;
      const isPassed = finalPercentage >= activeQuiz.passPercentage;

      const finalStatus = forceLockout ? 'Locked Out' : 'Submitted';
      const secondsConsumed = (activeQuiz.timeLimit * 60) - timeLeft;

      const attemptDocRef = doc(db, 'attempts', activeAttemptId);
      const currentFlags = [...cheatFlagsRef.current];

      const finalAttemptData: Attempt = {
        id: activeAttemptId,
        hubId: activeHub?.id || '',
        quizId: activeQuiz.id,
        userId: user?.uid || '',
        userName: profile?.name || '',
        userCnic: profile?.cnic || '',
        userEmail: user?.email || '',
        score: finalScore,
        timeSpentSeconds: secondsConsumed,
        passed: isPassed,
        cheatFlags: currentFlags,
        status: finalStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write final attempt evaluation
      await updateDoc(attemptDocRef, {
        score: finalScore,
        timeSpentSeconds: secondsConsumed,
        passed: isPassed,
        status: finalStatus,
        updatedAt: serverTimestamp()
      });

      setFinalAttempt(finalAttemptData);
      setIsQuizStarted(false);
      setActiveAttemptId(null);
    } catch (err: any) {
      console.error('Quiz submission error:', err);
      setError(err.message || 'Submission evaluation failed.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // 7. Dynamic Style Variables for Tenant branding
  const tenantColors = {
    '--primary': activeHub ? activeHub.primaryColor : '#2563eb',
    '--secondary': activeHub ? activeHub.secondaryColor : '#4f46e5',
    '--accent': activeHub ? activeHub.secondaryColor : '#ea580c',
  } as React.CSSProperties;

  const timeLock = activeQuiz ? isOutsideTimeWindow(activeQuiz) : null;
  const schedule = activeQuiz ? getQuizSchedule(activeQuiz) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>
      
      {/* 1. PORTAL ACCESS (HUB ENTRY SCREEN) */}
      {!activeHub && !finalAttempt && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg mx-auto shadow-lg"
        >
          <div className="text-center mb-6">
            <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-full inline-flex items-center justify-center mb-3">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-brand-text">Enter Participant Arena</h2>
            <p className="text-xs text-brand-muted mt-1">
              Input your organization's custom Hub ID to load branding configurations.
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 border-l-4 rounded-r-lg text-sm font-medium flex items-center gap-2 ${
              isColorblind
                ? 'bg-orange-50 border-orange-500 text-orange-950'
                : 'bg-red-50 border-red-500 text-red-800'
            }`}>
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-bold">{isColorblind ? '[ERROR] ' : ''}</span>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleLoadHub} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-brand-text mb-1">Organization Hub ID</label>
              <input
                type="text"
                required
                value={hubIdInput}
                onChange={(e) => setHubIdInput(e.target.value)}
                placeholder="Paste Hub ID Code here"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm font-mono text-center font-semibold"
                id="hub-search-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-white py-2.5 rounded-lg font-bold text-sm tracking-wide hover:bg-opacity-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
              id="hub-search-submit"
            >
              Load Custom Hub <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </motion.div>
      )}

      {/* 2. QUIZ CODE ENTRY (INSIDE BRANDED HUB) */}
      {activeHub && !activeQuiz && !finalAttempt && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg mx-auto shadow-lg relative overflow-hidden"
        >
          {/* Active Access Whitelist Logic / Attempt Cap Blocking Overlay */}
          {(isWhitelistBlocked || isAttemptsExhausted) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-brand-card/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-25"
            >
              <div className="bg-brand-primary/10 text-brand-primary p-4 rounded-full mb-4">
                <ShieldAlert className="h-10 w-10 animate-bounce" />
              </div>
              <h3 className="text-lg font-black text-brand-text mb-2 tracking-tight uppercase">
                {isWhitelistBlocked ? 'Whitelist Check Failed' : 'Attempt Limit Exhausted'}
              </h3>
              <p className="text-xs text-brand-muted max-w-sm mb-6 leading-relaxed">
                {isWhitelistBlocked 
                  ? `Access Blocked: Your registered identity (CNIC: ${profile?.cnic || 'N/A'}) is not registered on the security whitelist for this competitive examination environment.`
                  : `Room Ingestion Blocked: You have completed all allocated attempts allowed for this assessment portal.`
                }
              </p>
              <div className="bg-brand-bg rounded-lg p-3 text-left text-xs font-mono mb-6 w-full border border-brand-border space-y-1">
                <div><span className="font-bold text-brand-muted">Candidate:</span> {profile?.name}</div>
                <div><span className="font-bold text-brand-muted">CNIC Identity:</span> {profile?.cnic}</div>
                <div><span className="font-bold text-brand-muted">Environment Code:</span> {quizIdInput}</div>
              </div>
              <button
                onClick={() => {
                  setIsWhitelistBlocked(false);
                  setIsAttemptsExhausted(false);
                  setError(null);
                }}
                className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg text-xs hover:bg-opacity-90 cursor-pointer transition-all shadow-xs"
              >
                Return to Search
              </button>
            </motion.div>
          )}

          {/* Branded Hub Header */}
          <div className="text-center mb-6 pb-6 border-b border-brand-border">
            <img 
              src={activeHub.logoUrl} 
              alt="Logo" 
              className="w-16 h-16 rounded-xl mx-auto mb-3 object-contain border bg-white p-1" 
              referrerPolicy="no-referrer"
            />
            <h2 className="text-2xl font-black text-brand-text">{activeHub.hubName}</h2>
            <span className="text-2xs font-extrabold uppercase tracking-widest text-brand-muted block mt-1" style={{ color: 'var(--primary)' }}>
              Branded Tenant Hub
            </span>
            <button 
              onClick={() => { setActiveHub(null); setError(null); }}
              className="text-2xs text-brand-primary hover:underline font-bold mt-2 cursor-pointer inline-flex items-center gap-1"
            >
              <CornerDownLeft className="h-3 w-3" /> Connect different Hub
            </button>
          </div>

          {error && (
            <div className={`mb-6 p-4 border-l-4 rounded-r-lg text-sm font-medium flex items-center gap-2 ${
              isColorblind
                ? 'bg-orange-50 border-orange-500 text-orange-950'
                : 'bg-red-50 border-red-500 text-red-800'
            }`}>
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-bold">{isColorblind ? '[ERROR] ' : ''}</span>
                {error}
              </div>
            </div>
          )}

          {/* Load Quiz code */}
          <form onSubmit={handleLoadQuiz} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-brand-text mb-1">Enter Quiz Code</label>
              <p className="text-xs text-brand-muted mb-2">Input the code provided by your organization's supervisor.</p>
              <input
                type="text"
                required
                value={quizIdInput}
                onChange={(e) => setQuizIdInput(e.target.value)}
                placeholder="E.g., quiz_x9fs8w"
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm font-mono text-center font-semibold"
                id="quiz-search-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2.5 rounded-lg font-bold text-sm tracking-wide hover:bg-opacity-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
              style={{ backgroundColor: 'var(--primary)' }}
              id="quiz-search-submit"
            >
              Verify Quiz Code <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </motion.div>
      )}

      {/* 3. CONFIRM START (PROCTORING DISCLOSURES / SCHEDULE LOCK GATEWAY) */}
      {activeHub && activeQuiz && !isQuizStarted && !finalAttempt && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-xl mx-auto shadow-lg"
        >
          {/* Branded Hub Header */}
          <div className="text-center mb-6 pb-6 border-b border-brand-border">
            <img 
              src={activeHub.logoUrl} 
              alt="Logo" 
              className="w-12 h-12 rounded-lg mx-auto mb-2 object-contain border bg-white p-1" 
              referrerPolicy="no-referrer"
            />
            <h2 className="text-xl font-bold text-brand-text">{activeQuiz.title}</h2>
            <p className="text-xs text-brand-muted mt-1">{activeHub.hubName} micro-portal</p>
          </div>

          {timeLock ? (
            /* HARD-LOCKED TEMPORAL GATEWAY PANEL */
            <div className={`border rounded-xl p-6 text-center ${
              isColorblind 
                ? 'border-orange-500 bg-orange-50/20 text-orange-950' 
                : 'border-red-300 bg-red-50 text-red-900'
            }`}>
              <div className="flex justify-center mb-4">
                <Lock className={`h-12 w-12 animate-bounce ${isColorblind ? 'text-orange-600' : 'text-red-600'}`} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-wider mb-2">
                {isColorblind ? '[SECURE LOCK] TEMPORAL GATEWAY LOCKED' : 'Temporal Gateway Locked'}
              </h3>
              <p className="text-xs mb-4">
                This competitive assessment is currently outside of its precise operational hours. Entry is strictly prevented by the security proctoring system.
              </p>
              <div className="bg-brand-bg rounded-lg p-4 space-y-2 text-left text-xs font-semibold border border-brand-border">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Quiz Scheduled Open:</span>
                  <span className="text-brand-text">{schedule?.start ? new Date(schedule.start).toLocaleString() : 'Immediate Access'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Quiz Scheduled Close:</span>
                  <span className="text-brand-text">{schedule?.end ? new Date(schedule.end).toLocaleString() : 'No Close Deadline'}</span>
                </div>
                <div className="flex justify-between border-t border-brand-border pt-2 mt-2 font-black">
                  <span className={isColorblind ? 'text-blue-700' : 'text-brand-primary'}>Your Current System Time:</span>
                  <span className="text-brand-text">{new Date().toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => { setActiveQuiz(null); setQuizQuestions([]); }}
                className="mt-6 w-full bg-brand-primary text-white py-2.5 rounded-lg font-bold text-sm hover:bg-opacity-95 cursor-pointer"
              >
                Return to Hub
              </button>
            </div>
          ) : (
            /* STANDARD ACTIVE ENVIRONMENT DISCLOSURES */
            <>
              <div className={`border rounded-xl p-5 mb-6 ${
                isColorblind 
                  ? 'bg-blue-50 border-blue-200 text-blue-900' 
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <h3 className="text-sm font-extrabold flex items-center gap-1.5 mb-2 uppercase tracking-wide">
                  <ShieldAlert className={`h-5 w-5 animate-pulse ${isColorblind ? 'text-blue-700' : 'text-red-600'}`} />
                  {isColorblind ? '[SECURE] PROCTORED ASSESSMENT ROOM' : 'Proctored Environment Active!'}
                </h3>
                <ul className="text-xs space-y-2 list-disc list-inside">
                  <li><strong>Focus Lock:</strong> Do not exit or minimize the exam window. Losing focus triggers a real-time infraction log.</li>
                  <li><strong>Tab Change Lockdown:</strong> Do NOT navigate away. Switching tabs is instantly logged to Firestore as an infraction.</li>
                  <li><strong>Layout Device Lockdown:</strong> Clipboard Copy/Paste shortcuts and Right-click context menus are completely disabled.</li>
                  <li><strong>Verified Identity:</strong> Your exam results will be digitally logged and verified against CNIC {profile?.cnic}.</li>
                </ul>
              </div>

              <div className="flex justify-between items-center bg-brand-bg p-4 rounded-xl mb-6 text-xs text-brand-muted font-bold uppercase tracking-wider border border-brand-border">
                <span>Timer Limit: {activeQuiz.timeLimit} Minutes</span>
                <span>Pass Score Threshold: {activeQuiz.passPercentage}%</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setActiveQuiz(null); setQuizQuestions([]); }}
                  className="flex-1 border border-brand-border text-brand-text py-2.5 rounded-lg text-sm font-bold hover:bg-brand-bg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartQuiz}
                  disabled={loading}
                  className="flex-1 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                  style={{ backgroundColor: 'var(--primary)' }}
                  id="start-quiz-btn"
                >
                  Start Proctored Exam
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 4. ACTIVE QUIZ TAKE ROOM (PROCTORING ON) */}
      {isQuizStarted && activeQuiz && quizQuestions.length > 0 && (
        <div className="space-y-6">
          
          {/* Floating Proctored Header */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 sticky top-4 z-50 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg animate-pulse flex items-center justify-center ${
                isColorblind ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
              }`}>
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <span className="text-2xs text-brand-muted font-bold uppercase tracking-widest block">
                  {isColorblind ? '[SECURE MONITORING]' : 'Proctored Session'}
                </span>
                <span className="text-sm font-black text-brand-text truncate max-w-[200px] md:max-w-xs block">{activeQuiz.title}</span>
              </div>
            </div>

            {/* Timer widget */}
            <div className={`font-bold px-4 py-2 rounded-xl flex items-center gap-2 font-mono text-sm sm:text-base shadow-xs animate-bounce ${
              isColorblind 
                ? 'bg-blue-100 border border-blue-300 text-blue-900' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <Timer className="h-5 w-5" />
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60) < 10 ? '0' : ''}{timeLeft % 60}
            </div>
          </div>

          {/* Progress indicators */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
            <div className="flex justify-between text-xs text-brand-muted font-bold uppercase tracking-wider mb-2">
              <span>Question {currentQuestionIdx + 1} of {quizQuestions.length}</span>
              <span>Progress: {Math.round(((currentQuestionIdx) / quizQuestions.length) * 100)}%</span>
            </div>
            
            <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden border border-brand-border">
              <div 
                className="h-full transition-all duration-300" 
                style={{ 
                  backgroundColor: isColorblind ? '#1d4ed8' : 'var(--primary)',
                  width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-xs">
            <h3 className="text-lg font-extrabold text-brand-text mb-6">
              {quizQuestions[currentQuestionIdx].text}
            </h3>

            {/* Answer Options */}
            <div className="space-y-3.5">
              {quizQuestions[currentQuestionIdx].options.map((option, idx) => {
                const qId = quizQuestions[currentQuestionIdx].id;
                const isSelected = answers[qId] === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isQuestionMutationsLocked) return;
                      setAnswers((prev) => ({
                        ...prev,
                        [qId]: idx
                      }));
                    }}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? isColorblind
                          ? 'border-blue-700 bg-blue-50/20 text-blue-900 shadow-sm'
                          : 'border-brand-primary bg-brand-primary/5 shadow-xs'
                        : 'border-brand-border hover:border-brand-primary/50 hover:bg-brand-bg'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs ${
                        isSelected 
                          ? isColorblind 
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-brand-primary text-white border-brand-primary' 
                          : 'bg-brand-bg border-brand-border text-brand-muted'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm font-semibold text-brand-text">{option}</span>
                    </div>

                    {isSelected && (
                      isColorblind ? (
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">[SELECTED]</span>
                      ) : (
                        <CheckCircle className="h-5 w-5 text-brand-primary" />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation controller */}
          <div className="flex justify-between items-center gap-4">
            <button
              onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
              disabled={currentQuestionIdx === 0}
              className="px-5 py-2.5 rounded-lg border border-brand-border text-brand-text font-bold text-sm bg-brand-card hover:bg-brand-bg disabled:opacity-30 cursor-pointer transition-all"
            >
              Previous
            </button>

            {currentQuestionIdx < quizQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                className="px-6 py-2.5 rounded-lg text-white font-bold text-sm hover:bg-opacity-95 cursor-pointer transition-all"
                style={{ backgroundColor: isColorblind ? '#1d4ed8' : 'var(--primary)' }}
              >
                Next Question
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm('Are you ready to submit your exam answers?')) {
                    handleSubmitQuiz('Submitted');
                  }
                }}
                disabled={loading}
                className="px-8 py-2.5 rounded-lg text-white font-extrabold text-sm hover:bg-opacity-95 shadow-xs cursor-pointer transition-all"
                style={{ backgroundColor: isColorblind ? '#ea580c' : 'var(--accent)' }}
                id="submit-quiz-btn"
              >
                {loading ? 'Submitting Answers...' : 'Submit Quiz Exam'}
              </button>
            )}
          </div>

        </div>
      )}

      {/* 5. SECURE Digital Scores Room */}
      {finalAttempt && activeHub && activeQuiz && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
            
            {/* Score Stats Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center p-4 rounded-full border mb-4 ${
                isColorblind 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-brand-bg border-brand-border'
              }`}>
                {finalAttempt.passed ? (
                  isColorblind ? (
                    <span className="text-lg font-bold font-mono text-blue-700">[PASSED]</span>
                  ) : (
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  )
                ) : (
                  isColorblind ? (
                    <span className="text-lg font-bold font-mono text-orange-600">[FAILED]</span>
                  ) : (
                    <AlertOctagon className="h-12 w-12 text-red-500" />
                  )
                )}
              </div>
              <h2 className="text-2xl font-black text-brand-text">
                {finalAttempt.passed 
                  ? `${isColorblind ? '[PASSED] ' : ''}Congratulations, you passed!` 
                  : `${isColorblind ? '[FAILED] ' : ''}Quiz Attempt Completed`
                }
              </h2>
              <p className="text-sm text-brand-muted mt-1">
                Evaluation results for {activeQuiz.title}
              </p>
            </div>

            {/* Score statistics grid */}
            <div className="grid grid-cols-2 gap-4 bg-brand-bg border border-brand-border rounded-xl p-4 mb-8 text-center">
              <div>
                <span className="text-3xs font-extrabold text-brand-muted uppercase tracking-wider block">Raw Score Achieved</span>
                <span className="text-xl font-black text-brand-text">{finalAttempt.score} Points</span>
              </div>
              <div>
                <span className="text-3xs font-extrabold text-brand-muted uppercase tracking-wider block">Passing Threshold</span>
                <span className="text-xl font-black text-brand-text">{activeQuiz.passPercentage}% Score</span>
              </div>
            </div>

            {/* SECURE SUBMISSION REPORT & ARCHIVE STAMP */}
            {finalAttempt.passed ? (
              <div className={`border rounded-xl p-6 text-center ${
                isColorblind 
                  ? 'border-blue-500 bg-blue-50/10 text-blue-900' 
                  : 'border-green-200 bg-green-50/20 text-green-900'
              }`}>
                <h3 className="text-base font-black mb-2 flex items-center justify-center gap-1">
                  {isColorblind ? '[PASSED] ASSESSMENT VERIFIED' : 'Assessment Verified & Saved Successfully'}
                </h3>
                <p className="text-xs mb-4">
                  Your competitive examination has been verified under strict proctoring guidelines. The record has been permanently archived in the organization database.
                </p>
                
                <div className="bg-brand-bg rounded-lg p-4 text-left text-xs font-mono space-y-1.5 border border-brand-border">
                  <div><span className="text-brand-muted font-bold uppercase">Candidate:</span> {finalAttempt.userName}</div>
                  <div><span className="text-brand-muted font-bold uppercase">CNIC Number:</span> {finalAttempt.userCnic}</div>
                  <div><span className="text-brand-muted font-bold uppercase">Email ID:</span> {finalAttempt.userEmail}</div>
                  <div><span className="text-brand-muted font-bold uppercase">Attempt Signature:</span> {finalAttempt.id}</div>
                  <div><span className="text-brand-muted font-bold uppercase">Archived Stamp:</span> {new Date(finalAttempt.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div className={`border rounded-xl p-5 text-center ${
                isColorblind 
                  ? 'border-orange-300 bg-orange-50/40 text-orange-950' 
                  : 'border-red-200 bg-red-50/40 text-red-900'
              }`}>
                <p className="text-xs font-semibold">
                  {isColorblind ? '[WRONG / BELOW PASS THRESHOLD] ' : ''}
                  Your final score was below the pass threshold of <strong>{activeQuiz.passPercentage}%</strong>. Please contact your organization hub supervisor {activeHub.hubName} to request a re-schedule of this competitive quiz.
                </p>
              </div>
            )}

          </div>

          {/* Actions controllers */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setFinalAttempt(null);
                setActiveQuiz(null);
                setActiveHub(null);
                setQuizIdInput('');
                setHubIdInput('');
              }}
              className="bg-brand-card border border-brand-border text-brand-text px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-bg transition-all cursor-pointer flex items-center gap-1.5"
            >
              Exit Arena
            </button>
          </div>
        </motion.div>
      )}

      {/* 6. STRICT PROCTORING OPERATIONAL WARNING / LOCKOUT MODAL */}
      {warningModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`max-w-md w-full border-2 rounded-2xl p-6 shadow-2xl text-center ${
              isColorblind
                ? 'bg-slate-900 border-orange-500 text-orange-100'
                : 'bg-brand-card border-red-500 text-brand-text'
            }`}
          >
            <div className="flex justify-center mb-4 text-red-500">
              <ShieldAlert className="h-14 w-14 animate-bounce" />
            </div>

            <h3 className="text-xl font-black uppercase tracking-wider mb-2">
              {isColorblind ? '[PROCTOR EXCEPTION WARNING]' : 'Proctoring Security Alert'}
            </h3>

            <p className="text-sm leading-relaxed mb-6">
              {warningModalMessage}
            </p>

            {isQuestionMutationsLocked ? (
              <div className="space-y-4">
                <p className="text-xs font-mono text-red-400 bg-red-950/30 p-2.5 rounded border border-red-900">
                  SESSION SUSPENDED - SCORE AUTO-SUBMITTED
                </p>
                <button
                  onClick={() => {
                    setWarningModalOpen(false);
                    setFinalAttempt(null);
                    setActiveQuiz(null);
                    setActiveHub(null);
                    setQuizIdInput('');
                    setHubIdInput('');
                  }}
                  className="w-full bg-red-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  Exit Exam Portal
                </button>
              </div>
            ) : (
              <button
                onClick={handleDismissWarning}
                className={`w-full font-extrabold py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                  isColorblind 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-brand-primary text-white hover:bg-opacity-90'
                }`}
              >
                Acknowledge & Resume
              </button>
            )}
          </motion.div>
        </div>
      )}

    </div>
  );
};
