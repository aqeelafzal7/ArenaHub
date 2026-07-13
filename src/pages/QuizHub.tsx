import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
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
  serverTimestamp,
  onSnapshot
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
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as blazeface from '@tensorflow-models/blazeface';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface VideoPreviewProps {
  srcStream: MediaStream;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ srcStream, videoRef }) => {
  useEffect(() => {
    if (videoRef.current && srcStream) {
      videoRef.current.srcObject = srcStream;
    }
  }, [srcStream, videoRef]);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-brand-primary shadow-lg bg-black flex items-center justify-center relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
      <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
        <span className="text-[8px] sm:text-[9px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 font-extrabold tracking-widest px-1.5 py-0.5 rounded uppercase animate-pulse shadow-md">
          Scanning...
        </span>
      </div>
    </div>
  );
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzYw0GXrK2VPraB_fh3lT0gJr2EXF53I9HMKP0rkWN-rG_NTYfdXIzUfP-nwT9ftHoE/exec';

const SUSPICIOUS_KEYWORDS = [
  // English
  'answer', 'question', 'search', 'google', 'chat gpt', 'tell me', 'what is', 'option',
  // Roman Urdu / Hindi
  'jawab', 'batao', 'madad', 'kya hai', 'sawal', 'dhundo', 'bhai', 'yaar',
  // Roman Punjabi
  'dasso', 'ki ae', 'kivein', 'bol',
  // Urdu Script (In case the OS natively translates it)
  'جواب', 'سوال', 'بتاؤ', 'مدد', 'کیا'
];

export const QuizHub: React.FC = () => {
  const { user, profile, theme, isQuizStarted, setIsQuizStarted } = useAuth();
  const isColorblind = theme === 'colorblind';

  // Camera/Proctor stream states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<string>('Requesting...');
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  const setAndRefStream = (newStream: MediaStream | null) => {
    setStream(newStream);
    streamRef.current = newStream;
  };

  const captureAndUploadSnapshot = async (filenameLabel: string): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return null;

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;

      // Draw current video stream frame onto hidden canvas
      context.drawImage(videoRef.current, 0, 0, 640, 480);

      // Convert to highly compressed, efficient JPEG text stream (0.6 quality)
      const base64Image = canvas.toDataURL('image/jpeg', 0.6);
      const filename = `${profile?.name || 'Candidate'}_${filenameLabel}_${Date.now()}.jpg`;

      // Post payload to our 5TB Google Drive bridge
      const response = await fetch(GAS_WEBHOOK_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' }, // Avoid CORS preflight validation issues
        body: JSON.stringify({ image: base64Image, filename: filename })
      });

      const result = await response.json();
      return result.success ? result.url : null;
    } catch (err) {
      console.error('Forensic upload to Google Drive failed:', err);
      return null;
    }
  };

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
  const lastUploadTimeRef = useRef<number>(0);
  const compulsoryShotsTakenRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const speechThrottleRef = useRef<number>(0);

  // Proctoring Alert Modal States
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningModalMessage, setWarningModalMessage] = useState('');
  const [isQuestionMutationsLocked, setIsQuestionMutationsLocked] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('Listening for audio...');

  // Result States
  const [finalAttempt, setFinalAttempt] = useState<Attempt | null>(null);

  // Feedback/Loading States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Legal-Grade Telemetry States
  const [ipAddress, setIpAddress] = useState<string>('Fetching...');
  const [deviceInfo, setDeviceInfo] = useState<string>('Unknown Device');
  const [exactStartTime, setExactStartTime] = useState<string>('');

  const handleSoftRefresh = () => {
    const savedAnswers = localStorage.getItem('arena_saved_answers');
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }
  };

  // Fetch Telemetry on Mount
  useEffect(() => {
    // Fetch IP address
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((data) => setIpAddress(data.ip || 'Unavailable'))
      .catch(() => setIpAddress('Unavailable'));

    // Determine OS and Device Type from navigator.userAgent
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const deviceType = isMobile ? 'Mobile' : 'Desktop';
    setDeviceInfo(`${os} - ${deviceType}`);
  }, []);

  // Session Hydration on Mount / Auth state resolution
  useEffect(() => {
    const hydrateActiveSession = async () => {
      if (!user) return;
      const cached = localStorage.getItem('arena_active_session');
      if (!cached) return;

      try {
        setLoading(true);
        const session = JSON.parse(cached);
        const { hubId, quizId, attemptId, startedAt } = session;

        // Fetch attempt
        const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
        if (!attemptDoc.exists()) {
          // Stale cache
          localStorage.removeItem('arena_active_session');
          localStorage.removeItem('arena_saved_answers');
          return;
        }

        const attemptData = attemptDoc.data() as Attempt;
        if (attemptData.status !== 'In Progress') {
          // Already submitted or locked out
          localStorage.removeItem('arena_active_session');
          localStorage.removeItem('arena_saved_answers');
          return;
        }

        // Fetch Hub and Quiz
        const [hubDoc, quizDoc] = await Promise.all([
          getDoc(doc(db, 'hubs', hubId)),
          getDoc(doc(db, 'quizzes', quizId))
        ]);

        if (!hubDoc.exists() || !quizDoc.exists()) {
          return;
        }

        const hubData = hubDoc.data() as Hub;
        const quizData = quizDoc.data() as Quiz;

        // Fetch Questions pool
        const qQuery = query(collection(db, 'questions'), where('quizId', '==', quizId));
        const questionsSnap = await getDocs(qQuery);
        let qList: Question[] = [];
        questionsSnap.forEach((docSnap) => {
          const q = docSnap.data() as Question;
          const shuffledOptions = q.options ? shuffleArray(q.options) : [];
          qList.push({
            ...q,
            options: shuffledOptions,
          });
        });
        
        qList = shuffleArray(qList);

        // Restore States
        setActiveHub(hubData);
        setActiveQuiz(quizData);
        setQuizQuestions(qList);
        setActiveAttemptId(attemptId);
        setExactStartTime(startedAt);

        // Calculate exact remaining time
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        const remaining = Math.max(0, (quizData.timeLimit * 60) - elapsed);
        setTimeLeft(remaining);

        // Restore saved answers
        const savedAnswersStr = localStorage.getItem('arena_saved_answers');
        if (savedAnswersStr) {
          try {
            setAnswers(JSON.parse(savedAnswersStr));
          } catch (e) {
            console.error('Error parsing saved answers:', e);
          }
        }

        setIsQuizStarted(true);
      } catch (err) {
        console.error('Error hydrating active session:', err);
      } finally {
        setLoading(false);
      }
    };

    hydrateActiveSession();
  }, [user]);

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
        let qList: Question[] = [];
        questionsSnap.forEach((docSnap) => {
          const q = docSnap.data() as Question;
          const shuffledOptions = q.options ? shuffleArray(q.options) : [];
          qList.push({
            ...q,
            options: shuffledOptions,
          });
        });
        
        qList = shuffleArray(qList);
        
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

    const startTimeISO = new Date().toISOString();
    setExactStartTime(startTimeISO);

    const attemptId = doc(collection(db, 'attempts')).id;
    const path = `attempts/${attemptId}`;

    const finalCameraStatus = cameraStatus === 'Requesting...' ? 'Hardware Initialization Timeout' : cameraStatus;

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
      cameraStatus: finalCameraStatus,
      ipAddress: ipAddress,
      deviceInfo: deviceInfo,
      startedAt: startTimeISO,
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

      localStorage.setItem('arena_active_session', JSON.stringify({
        hubId: activeHub.id,
        quizId: activeQuiz.id,
        attemptId: attemptId,
        startedAt: startTimeISO
      }));

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
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.error('Error stopping tracks on start error:', e);
        }
      }
      setAndRefStream(null);
    } finally {
      setLoading(false);
    }
  };

  // 3.5 Submit Quiz Handler (Stable Callback)
  const handleSubmitQuiz = useCallback(async (reason: 'Submitted' | 'Timer Expired' | 'Locked Out', forceLockout = false) => {
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
      const finalAnswers = { ...answers };

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
        studentAnswers: finalAnswers,
        ipAddress: ipAddress,
        deviceInfo: deviceInfo,
        startedAt: exactStartTime,
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write final attempt evaluation
      await updateDoc(attemptDocRef, {
        score: finalScore,
        timeSpentSeconds: secondsConsumed,
        passed: isPassed,
        status: finalStatus,
        studentAnswers: finalAnswers,
        ipAddress: ipAddress,
        deviceInfo: deviceInfo,
        startedAt: exactStartTime,
        submittedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      localStorage.removeItem('arena_active_session');
      localStorage.removeItem('arena_saved_answers');

      setFinalAttempt(finalAttemptData);
      setIsQuizStarted(false);
      setActiveAttemptId(null);

      // Stop camera stream on successful submission
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => track.stop());
        } catch (e) {
          console.error('Error stopping stream tracks on submit:', e);
        }
        setAndRefStream(null);
      }
    } catch (err: any) {
      console.error('Quiz submission error:', err);
      setError(err.message || 'Submission evaluation failed.');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }, [activeAttemptId, activeQuiz, quizQuestions, answers, timeLeft, activeHub, user, profile, ipAddress, deviceInfo, exactStartTime]);

  // Camera & stream lifecycle hooks
  useEffect(() => {
    const isAtInstructions = activeHub && activeQuiz && !isQuizStarted && !finalAttempt;
    const isTaking = activeHub && activeQuiz && isQuizStarted && !finalAttempt;

    // FIX: Request camera if at instructions OR if taking the quiz (e.g., after a page refresh)
    if ((isAtInstructions || isTaking) && !streamRef.current) {
      const requestCamera = async () => {
        try {
          setCameraStatus('Requesting...');
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setAndRefStream(mediaStream);
          setCameraStatus('Active');
        } catch (err: any) {
          console.warn('Camera access error:', err);
          if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setCameraStatus('No Hardware');
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraStatus('Permission Denied');
          } else {
            setCameraStatus('Permission Denied');
          }
        }
      };
      requestCamera();
    }

    // Stop streams if we cancel or leave the instructions/taking views
    if (!isAtInstructions && !isTaking && streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.error('Error stopping tracks:', e);
      }
      setAndRefStream(null);
    }
  }, [activeHub, activeQuiz, isQuizStarted, finalAttempt]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((track) => track.stop());
        } catch (e) {
          console.error('Error stopping tracks on unmount:', e);
        }
      }
    };
  }, []);

  // 4.1 AI Vision Proctoring Detection Loop (Warning-Only)
  useEffect(() => {
    if (!isQuizStarted || !activeAttemptId) return;

    let isCancelled = false;
    let cocoModel: any = null;
    let faceModel: any = null;

    const loadModelsAndStartLoop = async () => {
      try {
        console.log('Initializing AI Vision Proctoring models...');
        await tf.ready();
        const [loadedCoco, loadedFace] = await Promise.all([
          cocoSsd.load(),
          blazeface.load()
        ]);

        if (isCancelled) return;
        cocoModel = loadedCoco;
        faceModel = loadedFace;
        console.log('AI models loaded successfully!');

        const interval = setInterval(async () => {
          if (isCancelled || !videoRef.current || videoRef.current.readyState < 2) return;

          try {
            const videoEl = videoRef.current;

            // 1. Detect cell phones (coco-ssd)
            const predictions = await cocoModel.detect(videoEl);
            const hasPhone = predictions.some((pred: any) => pred.class === 'cell phone');

            if (hasPhone) {
              console.log('AI Detected: Cell Phone');
              await updateDoc(doc(db, 'attempts', activeAttemptId), {
                cheatFlags: arrayUnion('AI Flag: Cell Phone Detected')
              });
              setAiWarning('Warning: Suspicious activity detected by camera.');

              const now = Date.now();
              if (now - lastUploadTimeRef.current > 45000) { // 45-second throttling lock
                lastUploadTimeRef.current = now;
                
                // Capture image asynchronously
                captureAndUploadSnapshot('Phone_Violation').then(async (driveUrl) => {
                  if (driveUrl) {
                    const logMsg = `AI Flag: Cell Phone Detected [Proof Link: ${driveUrl}]`;
                    
                    // Update firestore attempt log dynamically
                    await updateDoc(doc(db, 'attempts', activeAttemptId), {
                      cheatFlags: arrayUnion(logMsg),
                      updatedAt: serverTimestamp()
                    });
                  }
                });
              }
            }

            // 2. Detect multiple faces (blazeface)
            const faces = await faceModel.estimateFaces(videoEl, false);
            if (faces.length > 1) {
              console.log('AI Detected: Multiple People');
              await updateDoc(doc(db, 'attempts', activeAttemptId), {
                cheatFlags: arrayUnion('AI Flag: Multiple People Detected')
              });
              setAiWarning('Warning: Suspicious activity detected by camera.');

              const now = Date.now();
              if (now - lastUploadTimeRef.current > 45000) { // 45-second throttling lock
                lastUploadTimeRef.current = now;
                
                // Capture image asynchronously
                captureAndUploadSnapshot('MultiFace_Violation').then(async (driveUrl) => {
                  if (driveUrl) {
                    const logMsg = `AI Flag: Multiple People Detected [Proof Link: ${driveUrl}]`;
                    
                    // Update firestore attempt log dynamically
                    await updateDoc(doc(db, 'attempts', activeAttemptId), {
                      cheatFlags: arrayUnion(logMsg),
                      updatedAt: serverTimestamp()
                    });
                  }
                });
              }
            }
          } catch (err) {
            console.error('AI Frame detection evaluation error:', err);
          }
        }, 3000);

        aiIntervalRef.current = interval;
        if (isCancelled) {
          clearInterval(interval);
          aiIntervalRef.current = null;
        }
      } catch (err) {
        console.error('Failed to load TFJS proctoring models:', err);
      }
    };

    loadModelsAndStartLoop();

    return () => {
      isCancelled = true;
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
        aiIntervalRef.current = null;
      }
    };
  }, [isQuizStarted, activeAttemptId]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (aiWarning) {
      const timer = setTimeout(() => {
        setAiWarning(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [aiWarning]);

  // Compulsory Verification Snapshots (5 shots spaced evenly)
  useEffect(() => {
    if (!isQuizStarted || !activeAttemptId || !activeQuiz) {
      compulsoryShotsTakenRef.current = 0;
      return;
    }

    const intervalMs = (activeQuiz.timeLimit * 60 * 1000) / 6;

    const snapshotInterval = setInterval(() => {
      if (compulsoryShotsTakenRef.current >= 5) {
        clearInterval(snapshotInterval);
        return;
      }
      
      compulsoryShotsTakenRef.current += 1;
      const currentShotNumber = compulsoryShotsTakenRef.current;
      
      captureAndUploadSnapshot(`Compulsory_Verification_V${currentShotNumber}`).then(async (driveUrl) => {
        if (driveUrl) {
          await updateDoc(doc(db, 'attempts', activeAttemptId), {
            marketingImages: arrayUnion(driveUrl),
            updatedAt: serverTimestamp()
          });
        }
      });
    }, intervalMs);
    
    return () => clearInterval(snapshotInterval);
  }, [isQuizStarted, activeAttemptId, activeQuiz]);

  // Advanced AI Speech Proctoring Engine
  useEffect(() => {
    if (!isQuizStarted || !activeAttemptId) return;

    // Cross-browser support (Chrome, Safari, Edge, Android, iOS)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setLiveTranscript("[ERROR] AI Speech not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening after they stop speaking
    // false means it waits for you to finish your sentence before evaluating
    recognition.interimResults = false; 
    // Optimize for regional accents (Pakistani English/Urdu mix)
    recognition.lang = 'en-PK';

    recognitionRef.current = recognition;

    // Auto-restart if it stops due to silence
    recognition.onend = () => {
      if (isQuizStarted && isListeningRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    // Advanced contextual speech evaluation
    recognition.onresult = async (event: any) => {
      const currentTranscript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      setLiveTranscript(currentTranscript);
      console.log("AI Acoustic Intercept:", currentTranscript);

      const now = Date.now();
      if (now - speechThrottleRef.current < 30000) return; // 30-second throttle

      let flagReason = '';
      const wordCount = currentTranscript.split(/\s+/).length;

      // Tier 1: Check against Multi-Lingual Blacklist
      const foundKeyword = SUSPICIOUS_KEYWORDS.find(word => currentTranscript.includes(word));
      if (foundKeyword) {
        flagReason = `Suspicious Keyword Spoken (${foundKeyword})`;
      } 
      // Tier 2: Dynamic Question Context Check
      else if (quizQuestions[currentQuestionIdx]) {
        const questionWords = quizQuestions[currentQuestionIdx].text.toLowerCase().split(' ').filter((w: string) => w.length > 4);
        const matchedContext = questionWords.find((word: string) => currentTranscript.includes(word));
        if (matchedContext) flagReason = `Spoke Exam Question Text (${matchedContext})`;
      }
      // Tier 3: The "Babble" Check (Catching unknown dialects by length)
      if (!flagReason && wordCount >= 5) {
        flagReason = `Sustained Conversational Talking Detected`;
      }

      // If any tier is triggered, log it and snap a photo
      if (flagReason) {
        speechThrottleRef.current = now;

        const driveUrl = await captureAndUploadSnapshot('Audio_Violation');
        const logMsg = `AI Flag: ${flagReason}. Transcript: "${currentTranscript}" ${driveUrl ? `[Proof Link: ${driveUrl}]` : ''}`;

        if (activeAttemptId) {
          await updateDoc(doc(db, 'attempts', activeAttemptId), {
            cheatFlags: arrayUnion(logMsg),
            updatedAt: serverTimestamp()
          });
        }
      }
    };

    // BUG FIX: Automatically start the engine the moment it is created!
    isListeningRef.current = true;
    try {
      recognition.start();
      console.log("AI Speech Engine Started Successfully");
    } catch (err) {
      console.error("Failed to start speech engine:", err);
    }

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isQuizStarted, activeAttemptId, quizQuestions, currentQuestionIdx]);

  // 4. Timer effect & Scheduled window breach check
  useEffect(() => {
    if (!isQuizStarted || !exactStartTime || !activeQuiz) return;

    timerRef.current = setInterval(() => {
      // Strict Expiration Enforcement
      const closeTime = activeQuiz.closeAt || (activeQuiz as any).endTime;
      if (closeTime) {
        const deadlineMs = new Date(closeTime).getTime();
        if (Date.now() >= deadlineMs) {
          if (timerRef.current) clearInterval(timerRef.current);
          setWarningModalMessage('SESSION EXPIRED: The official closing time for this exam has been reached.');
          setWarningModalOpen(true);
          handleSubmitQuiz('Timer Expired', true);
          return;
        }
      }

      // Absolute Time Calculation
      const startMs = new Date(exactStartTime).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
      const totalAllowedSeconds = activeQuiz.timeLimit * 60;
      const remaining = Math.max(0, totalAllowedSeconds - elapsedSeconds);
      setTimeLeft(remaining);

      // Standard Timeout
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleSubmitQuiz('Timer Expired', true);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isQuizStarted, exactStartTime, activeQuiz, handleSubmitQuiz]);

  // 4.5 Listen for Admin Remote Override (forceLocked)
  useEffect(() => {
    if (!activeAttemptId || !isQuizStarted) return;

    const unsubscribe = onSnapshot(doc(db, 'attempts', activeAttemptId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.forceLocked === true) {
          setIsQuestionMutationsLocked(true);
          setWarningModalMessage('SESSION OVERRIDE: This quiz session has been manually terminated by an administrator.');
          setWarningModalOpen(true);
          
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          
          submitQuiz('Manually Terminated by Administrator');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeAttemptId, isQuizStarted]);

  // 5. Proctoring Logger Callbacks
  const logCheatFlag = async (flag: string) => {
    if (isSubmittingRef.current) return;
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
    if (isSubmittingRef.current) return;
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
      if (isSubmittingRef.current) return;
      setWarningModalMessage(msg);
      setWarningModalOpen(true);
    },
    isSubmittingRef: isSubmittingRef
  });

  // Dismiss Warning Modal
  const handleDismissWarning = () => {
    setWarningModalOpen(false);
  };

  // 6. Submit Quiz Handler (moved above);

  const submitQuiz = useCallback(async (isAutoSubmit = false, reason = '') => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await handleSubmitQuiz('Locked Out', true);
    } catch (err) {
      isSubmittingRef.current = false;
      throw err;
    }
  }, [handleSubmitQuiz]);

  const handleSkip = () => {
    if (currentQuestionIdx + 1 < quizQuestions.length) {
      setCurrentQuestionIdx((prev) => prev + 1);
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

  const firstUnansweredIndex = quizQuestions.findIndex((q) => answers[q.id] === undefined);
  const currentQuestionId = quizQuestions[currentQuestionIdx]?.id;
  const hasSelectedOption = currentQuestionId ? answers[currentQuestionId] !== undefined : false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />
      
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
                  <li><strong>Acoustic Monitoring:</strong> Your microphone is active. Any talking, whispering, or contextual speech will be transcribed, recorded, and permanently flagged in your forensic audit.</li>
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

            {/* Timer & Refresh widget */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSoftRefresh} 
                title="Soft Refresh Room"
                className="p-2 rounded-xl border border-brand-border bg-brand-bg hover:bg-brand-primary/10 transition-colors cursor-pointer group"
              >
                <RefreshCw className="h-5 w-5 text-brand-muted group-hover:text-brand-primary transition-colors"/>
              </button>

              <div className={`font-bold px-4 py-2 rounded-xl flex items-center gap-2 font-mono text-sm sm:text-base shadow-xs animate-bounce ${
                isColorblind 
                  ? 'bg-blue-100 border border-blue-300 text-blue-900' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <Timer className="h-5 w-5" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60) < 10 ? '0' : ''}{timeLeft % 60}
              </div>
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
                      setAnswers((prev) => {
                        const updated = { ...prev, [qId]: idx };
                        localStorage.setItem('arena_saved_answers', JSON.stringify(updated));
                        return updated;
                      });
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
              disabled={currentQuestionIdx === 0 || isSubmittingRef.current || isQuestionMutationsLocked}
              className="px-5 py-2.5 rounded-lg border border-brand-border text-brand-text font-bold text-sm bg-brand-card hover:bg-brand-bg disabled:opacity-30 cursor-pointer transition-all"
            >
              Previous
            </button>

            {currentQuestionIdx + 1 < quizQuestions.length && !hasSelectedOption && (
              <button
                onClick={handleSkip}
                disabled={isSubmittingRef.current || isQuestionMutationsLocked}
                className="px-5 py-2.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text font-bold text-sm bg-brand-card hover:bg-brand-bg disabled:opacity-30 cursor-pointer transition-all"
              >
                Skip for Now
              </button>
            )}

            {currentQuestionIdx < quizQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                disabled={isSubmittingRef.current || isQuestionMutationsLocked}
                className="px-6 py-2.5 rounded-lg text-white font-bold text-sm hover:bg-opacity-95 disabled:opacity-30 cursor-pointer transition-all"
                style={{ backgroundColor: isColorblind ? '#1d4ed8' : 'var(--primary)' }}
              >
                Next Question
              </button>
            ) : firstUnansweredIndex !== -1 ? (
              <button
                onClick={() => setCurrentQuestionIdx(firstUnansweredIndex)}
                disabled={isSubmittingRef.current || isQuestionMutationsLocked}
                className="px-6 py-2.5 rounded-lg text-white font-bold text-sm hover:bg-opacity-95 disabled:opacity-30 cursor-pointer transition-all"
                style={{ backgroundColor: isColorblind ? '#1d4ed8' : 'var(--primary)' }}
              >
                Review Skipped Questions
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm('Are you ready to submit your exam answers?')) {
                    handleSubmitQuiz('Submitted');
                  }
                }}
                disabled={loading || isSubmittingRef.current || isQuestionMutationsLocked}
                className="px-8 py-2.5 rounded-lg text-white font-extrabold text-sm hover:bg-opacity-95 shadow-xs disabled:opacity-30 cursor-pointer transition-all"
                style={{ backgroundColor: isColorblind ? '#ea580c' : 'var(--accent)' }}
                id="submit-quiz-btn"
              >
                {loading ? 'Submitting Answers...' : 'Submit Quiz'}
              </button>
            )}
          </div>

          {stream && <VideoPreview srcStream={stream} videoRef={videoRef} />}
          {aiWarning && (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-55 bg-red-600 border border-red-500 text-white font-extrabold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
              <span className="text-sm">{aiWarning}</span>
            </div>
          )}
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
            
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center p-4 rounded-full border mb-4 ${
                isColorblind 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-brand-bg border-brand-border'
              }`}>
                <CheckCircle className="h-12 w-12 text-brand-primary" />
              </div>
              <h2 className="text-2xl font-black text-brand-text">
                Quiz Attempt Completed
              </h2>
              <p className="text-sm text-brand-muted mt-1">
                Evaluation submitted for {activeQuiz.title}
              </p>
            </div>

            {/* Custom Admin Announcement Text */}
            <div className="border border-brand-border rounded-xl p-6 bg-brand-bg/50 mb-8 text-center">
              <p className="text-sm text-brand-text leading-relaxed whitespace-pre-line">
                {activeQuiz.postSubmissionText && activeQuiz.postSubmissionText.trim() !== ''
                  ? activeQuiz.postSubmissionText
                  : "Your quiz has been submitted successfully. Results will be announced very soon."
                }
              </p>
            </div>

            {/* SECURE SUBMISSION REPORT & ARCHIVE STAMP */}
            <div className="border border-brand-border rounded-xl p-6 text-center bg-brand-bg">
              <h3 className="text-sm font-bold mb-3 text-brand-text flex items-center justify-center gap-1.5">
                Assessment Verified & Saved Successfully
              </h3>
              <p className="text-xs text-brand-muted mb-4">
                Your examination has been verified under strict proctoring guidelines. The record has been permanently archived in the organization database.
              </p>
              
              <div className="bg-brand-card rounded-lg p-4 text-left text-xs font-mono space-y-1.5 border border-brand-border">
                <div><span className="text-brand-muted font-bold uppercase">Candidate:</span> {finalAttempt.userName}</div>
                <div><span className="text-brand-muted font-bold uppercase">CNIC Number:</span> {finalAttempt.userCnic}</div>
                <div><span className="text-brand-muted font-bold uppercase">Email ID:</span> {finalAttempt.userEmail}</div>
                <div><span className="text-brand-muted font-bold uppercase">Attempt Signature:</span> {finalAttempt.id}</div>
                <div><span className="text-brand-muted font-bold uppercase">Archived Stamp:</span> {new Date(finalAttempt.updatedAt).toLocaleString()}</div>
              </div>
            </div>

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

      {isQuizStarted && (
        <div className="fixed bottom-4 left-4 z-50 bg-black/80 border border-brand-primary text-brand-primary p-3 rounded-xl max-w-sm shadow-2xl font-mono text-xs">
          <div className="font-bold mb-1 uppercase tracking-widest text-[10px] text-white">AI Acoustic Intercept (Debug)</div>
          {liveTranscript}
        </div>
      )}

    </div>
  );
};
