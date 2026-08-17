import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldAlert, CheckCircle, Video, Mic, AlertOctagon, Loader2 } from 'lucide-react';
import { Quiz, Hub } from '../types';

export const PreFlight: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [hardwareStatus, setHardwareStatus] = useState<'checking' | 'ready' | 'no_hardware_bypass' | 'permission_denied' | 'error'>('checking');
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        // Try fetching by document ID first
        let qDoc = await getDoc(doc(db, 'quizzes', id));
        let qData: Quiz | null = null;

        if (qDoc.exists()) {
          qData = { id: qDoc.id, ...qDoc.data() } as Quiz;
        } else {
          // Fallback: Check if it's a joinCode
          const q = query(collection(db, 'quizzes'), where('joinCode', '==', id.toUpperCase()));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            qData = { id: docSnap.id, ...docSnap.data() } as Quiz;
          }
        }

        if (qData) {
          setQuiz(qData);
          if (qData.hubId) {
             const hDoc = await getDoc(doc(db, 'hubs', qData.hubId));
             if (hDoc.exists()) {
               setHub(hDoc.data() as Hub);
             }
          }
        } else {
          setError('Quiz not found. Please check your join code.');
        }
      } catch (err) {
        console.error(err);
        setError('Error fetching details.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const checkHardware = async () => {
    setHardwareStatus('checking');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMic = devices.some(device => device.kind === 'audioinput');

      // If hardware exists, demand permissions
      if (hasCamera || hasMic) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: hasCamera,
          audio: hasMic
        });
        setHardwareStatus('ready'); // Unlocks "Start Quiz" button
        stream.getTracks().forEach(track => track.stop()); // Close stream until quiz starts
      } else {
        // Device physically lacks hardware (e.g., old desktop)
        setHardwareStatus('no_hardware_bypass'); // Unlocks "Start Quiz" button but logs warning
      }
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setHardwareStatus('permission_denied'); // BLOCKS "Start Quiz" button
      } else {
        setHardwareStatus('error');
      }
    }
  };

  useEffect(() => {
    checkHardware();
  }, []);

  const handleStartQuiz = async () => {
    if (!quiz || !user || !profile) return;
    setIsStarting(true);
    try {
      const isBypass = hardwareStatus === 'no_hardware_bypass';
      const startedAt = new Date().toISOString();
      const attemptData = {
        hubId: quiz.hubId,
        quizId: quiz.id,
        userId: user.uid,
        userName: profile.name,
        userCnic: profile.cnic,
        userEmail: user.email || '',
        score: 0,
        timeSpentSeconds: 0,
        passed: false,
        cheatFlags: [],
        status: 'In Progress',
        hardware_bypass: isBypass,
        startedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'attempts'), attemptData);
      
      // We can store attemptId in localStorage if we want to hydrate session
      localStorage.setItem('arena_active_session', JSON.stringify({
         hubId: quiz.hubId,
         quizId: quiz.id,
         attemptId: docRef.id,
         startedAt
      }));

      navigate(`/quiz/${quiz.id}/session`);
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError('Could not start quiz. Please try again.');
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-bold p-8 text-center">
        {error || 'Unknown error'}
      </div>
    );
  }

  const isReady = hardwareStatus === 'ready' || hardwareStatus === 'no_hardware_bypass';

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-xl">
        <h2 className="text-2xl font-black text-brand-text mb-2">{hub?.title || quiz.title}</h2>
        <p className="text-brand-muted mb-6">Pre-Flight Instructions & Hardware Check</p>
        
        <div className="bg-brand-bg border border-brand-border rounded-xl p-5 mb-6">
          <h3 className="font-bold text-brand-text mb-3">Exam Rules</h3>
          <ul className="space-y-2 text-sm text-brand-text/80 list-disc list-inside">
            <li>No tab switching allowed. Doing so will trigger a warning or immediate submission.</li>
            <li>You will be recorded. Please stay in the frame.</li>
            <li>No mobile phones or other devices allowed.</li>
            <li>No talking or background noise.</li>
            {quiz.perQuestionTimer && <li>You have {quiz.timePerQuestionSeconds} seconds per question.</li>}
            {!quiz.perQuestionTimer && quiz.timeLimit && <li>You have {quiz.timeLimit} minutes to complete the exam.</li>}
          </ul>
        </div>

        <div className="bg-brand-bg border border-brand-border rounded-xl p-5 mb-8">
          <h3 className="font-bold text-brand-text mb-4">Hardware Check</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${isReady ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {hardwareStatus === 'ready' && <CheckCircle className="w-6 h-6" />}
                {hardwareStatus === 'no_hardware_bypass' && <AlertOctagon className="w-6 h-6 text-amber-500" />}
                {hardwareStatus === 'permission_denied' && <ShieldAlert className="w-6 h-6 text-red-500" />}
                {hardwareStatus === 'checking' && <Loader2 className="w-6 h-6 animate-spin" />}
                {hardwareStatus === 'error' && <ShieldAlert className="w-6 h-6 text-red-500" />}
              </div>
              <div>
                <p className="font-bold text-brand-text">
                  {hardwareStatus === 'ready' && 'Camera & Microphone Ready'}
                  {hardwareStatus === 'no_hardware_bypass' && 'No Hardware Detected (Bypass Active)'}
                  {hardwareStatus === 'permission_denied' && 'Permission Denied'}
                  {hardwareStatus === 'checking' && 'Checking Hardware...'}
                  {hardwareStatus === 'error' && 'Hardware Check Failed'}
                </p>
                <p className="text-xs text-brand-muted">
                  {hardwareStatus === 'permission_denied' && 'You must allow camera and microphone access to proceed.'}
                  {hardwareStatus === 'no_hardware_bypass' && 'Your attempt will be flagged for manual review.'}
                </p>
              </div>
            </div>
            {hardwareStatus === 'permission_denied' && (
              <button onClick={checkHardware} className="text-sm font-bold text-brand-primary underline">
                Retry
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleStartQuiz}
          disabled={!isReady || isStarting}
          className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-3.5 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
        >
          {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Quiz'}
        </button>
      </div>
    </div>
  );
};
