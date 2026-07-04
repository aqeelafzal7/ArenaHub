import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { uploadToImgBB } from '../utils/upload';
import { Hub, Quiz, Question, Attempt } from '../types';
import { 
  Settings, 
  BookOpen, 
  Radio, 
  Upload, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Eye, 
  Layout, 
  User, 
  ShieldAlert, 
  FileText 
} from 'lucide-react';
import { motion } from 'motion/react';

export const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<'hub' | 'quizzes' | 'warroom'>('hub');

  // Hub States
  const [hub, setHub] = useState<Hub | null>(null);
  const [hubName, setHubName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#4f46e5');
  const [imgbbApiKey, setImgbbApiKey] = useState('');
  const [hubLoading, setHubLoading] = useState(false);
  const [hubSuccess, setHubSuccess] = useState(false);

  // Quiz States
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTimeLimit, setQuizTimeLimit] = useState(15); // in minutes
  const [quizPassPercentage, setQuizPassPercentage] = useState(50);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  // Manual Question Form States
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState(0); // 0 to 3 index
  const [questions, setQuestions] = useState<Question[]>([]);

  // CSV upload states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null);

  // War Room States
  const [liveQuizzes, setLiveQuizzes] = useState<Quiz[]>([]);
  const [activeLiveQuizId, setActiveLiveQuizId] = useState<string>('');
  const [liveAttempts, setLiveAttempts] = useState<Attempt[]>([]);

  // Feedback states
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Data Fetching
  useEffect(() => {
    if (!user) return;
    
    // Fetch Hub
    const fetchHub = async () => {
      const path = `hubs/${user.uid}`;
      try {
        const hubDoc = await getDoc(doc(db, 'hubs', user.uid));
        if (hubDoc.exists()) {
          const data = hubDoc.data() as Hub;
          setHub(data);
          setHubName(data.hubName);
          setLogoUrl(data.logoUrl);
          setPrimaryColor(data.primaryColor);
          setSecondaryColor(data.secondaryColor);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };

    // Fetch Quizzes
    const fetchQuizzes = async () => {
      const path = 'quizzes';
      try {
        const q = query(collection(db, 'quizzes'), where('hubId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const quizList: Quiz[] = [];
        querySnapshot.forEach((docSnap) => {
          quizList.push(docSnap.data() as Quiz);
        });
        setQuizzes(quizList);
        setLiveQuizzes(quizList.filter(quiz => quiz.isLiveCompetition));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };

    fetchHub();
    fetchQuizzes();
  }, [user]);

  // Fetch questions for a selected quiz
  useEffect(() => {
    if (!selectedQuiz) {
      setQuestions([]);
      return;
    }
    const fetchQuestions = async () => {
      const path = 'questions';
      try {
        const q = query(collection(db, 'questions'), where('quizId', '==', selectedQuiz.id));
        const snap = await getDocs(q);
        const qList: Question[] = [];
        snap.forEach((docSnap) => {
          qList.push(docSnap.data() as Question);
        });
        setQuestions(qList);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };
    fetchQuestions();
  }, [selectedQuiz]);

  // Real-time listener for War Room attempts
  useEffect(() => {
    if (!activeLiveQuizId) {
      setLiveAttempts([]);
      return;
    }
    
    const path = `attempts for quiz ${activeLiveQuizId}`;
    const q = query(collection(db, 'attempts'), where('quizId', '==', activeLiveQuizId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsList: Attempt[] = [];
      snapshot.forEach((docSnap) => {
        attemptsList.push(docSnap.data() as Attempt);
      });
      // Sort attempts by score descending, then by name
      attemptsList.sort((a, b) => b.score - a.score || a.userName.localeCompare(b.userName));
      setLiveAttempts(attemptsList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [activeLiveQuizId]);

  // 2. Hub branding form handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSaveHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setHubLoading(true);
    setHubSuccess(false);
    setError(null);

    const path = `hubs/${user.uid}`;
    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadToImgBB(logoFile, imgbbApiKey);
      }

      const hubData: Hub = {
        id: user.uid,
        ownerUid: user.uid,
        hubName: hubName.trim(),
        logoUrl: finalLogoUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150',
        primaryColor,
        secondaryColor,
        createdAt: hub?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'hubs', user.uid), hubData);
      setHub(hubData);
      setLogoUrl(finalLogoUrl);
      setHubSuccess(true);
      setTimeout(() => setHubSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update Hub branding');
    } finally {
      setHubLoading(false);
    }
  };

  // 3. Quiz form handlers
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hub) {
      setError('Please set up your Hub settings before creating quizzes.');
      return;
    }
    setQuizLoading(true);
    setError(null);

    const quizId = 'quiz_' + Math.random().toString(36).substring(2, 11);
    const path = `quizzes/${quizId}`;

    const newQuiz: Quiz = {
      id: quizId,
      hubId: hub.id,
      title: quizTitle.trim(),
      timeLimit: Number(quizTimeLimit),
      passPercentage: Number(quizPassPercentage),
      isActive: true,
      isLiveCompetition: false,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'quizzes', quizId), newQuiz);
      setQuizzes((prev) => [newQuiz, ...prev]);
      setQuizTitle('');
      setSelectedQuiz(newQuiz);
    } catch (err: any) {
      setError(err.message || 'Failed to create quiz');
    } finally {
      setQuizLoading(false);
    }
  };

  const toggleQuizStatus = async (quiz: Quiz, field: 'isActive' | 'isLiveCompetition') => {
    const path = `quizzes/${quiz.id}`;
    const updated = {
      ...quiz,
      [field]: !quiz[field]
    };
    try {
      await setDoc(doc(db, 'quizzes', quiz.id), updated);
      setQuizzes((prev) => prev.map(q => q.id === quiz.id ? updated : q));
      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(updated);
      }
      setLiveQuizzes(quizzes.map(q => q.id === quiz.id ? updated : q).filter(q => q.isLiveCompetition));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This will also remove all questions associated.')) return;
    const path = `quizzes/${quizId}`;
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
      setQuizzes((prev) => prev.filter(q => q.id !== quizId));
      if (selectedQuiz?.id === quizId) {
        setSelectedQuiz(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // 4. Questions form handlers
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    setError(null);

    const qId = 'q_' + Math.random().toString(36).substring(2, 11);
    const path = `questions/${qId}`;

    const newQuestion: Question = {
      id: qId,
      quizId: selectedQuiz.id,
      text: qText.trim(),
      options: [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()],
      correctOption: Number(qCorrect)
    };

    try {
      await setDoc(doc(db, 'questions', qId), newQuestion);
      setQuestions((prev) => [...prev, newQuestion]);
      // Reset inputs
      setQText('');
      setQOptA('');
      setQOptB('');
      setQOptC('');
      setQOptD('');
      setQCorrect(0);
    } catch (err: any) {
      setError(err.message || 'Failed to append question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const path = `questions/${questionId}`;
    try {
      await deleteDoc(doc(db, 'questions', questionId));
      setQuestions((prev) => prev.filter(q => q.id !== questionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // 5. CSV parser & bulk uploader
  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz || !csvFile) return;
    setCsvError(null);
    setCsvSuccessCount(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setCsvError('Failed to read file contents');
        return;
      }

      const lines = text.split('\n');
      const parsed: Question[] = [];
      let parseFailed = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Match comma-separated values (allowing quotes)
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 6) {
          const textVal = parts[0];
          const opts = [parts[1], parts[2], parts[3], parts[4]];
          const correctIdx = parseInt(parts[5], 10);
          
          if (!isNaN(correctIdx) && correctIdx >= 0 && correctIdx <= 3) {
            parsed.push({
              id: 'q_csv_' + Math.random().toString(36).substring(2, 11) + '_' + i,
              quizId: selectedQuiz.id,
              text: textVal,
              options: opts,
              correctOption: correctIdx
            });
          } else {
            setCsvError(`Row ${i + 1} has an invalid Correct Option index (must be 0, 1, 2, or 3)`);
            parseFailed = true;
            break;
          }
        } else {
          setCsvError(`Row ${i + 1} does not have at least 6 columns (question, opt1, opt2, opt3, opt4, correctIndex)`);
          parseFailed = true;
          break;
        }
      }

      if (parseFailed) return;

      if (parsed.length === 0) {
        setCsvError('No valid rows found in CSV');
        return;
      }

      // Upload sequentially to Firebase
      let uploadedCount = 0;
      try {
        for (const qObj of parsed) {
          const path = `questions/${qObj.id}`;
          await setDoc(doc(db, 'questions', qObj.id), qObj);
          uploadedCount++;
        }
        setQuestions((prev) => [...prev, ...parsed]);
        setCsvSuccessCount(uploadedCount);
        setCsvFile(null);
      } catch (err: any) {
        setCsvError(`Upload partially failed: ${err.message || 'Firebase error'}`);
      }
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-text flex items-center gap-3">
            <Layout className="h-8 w-8 text-brand-primary" />
            Organizer Panel
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Manage your hub micro-portal, build interactive quizzes, and watch attempts in the War Room.
          </p>
        </div>

        {/* Dynamic Tenant Status */}
        {hub && (
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-3 flex items-center gap-3">
            <img 
              src={hub.logoUrl} 
              alt="Logo" 
              className="w-10 h-10 rounded-lg object-contain bg-white border border-brand-border p-1" 
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-xs block text-brand-muted font-bold uppercase tracking-wider">Active Tenant</span>
              <span className="text-sm font-extrabold text-brand-text">{hub.hubName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Primary tab navigation bar */}
      <div className="flex border-b border-brand-border mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('hub')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'hub'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
          id="tab-btn-hub"
        >
          <Settings className="h-4 w-4" />
          Hub Branding Settings
        </button>
        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'quizzes'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
          id="tab-btn-quizzes"
        >
          <BookOpen className="h-4 w-4" />
          Quiz & Question Builder
        </button>
        <button
          onClick={() => setActiveTab('warroom')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'warroom'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
          id="tab-btn-warroom"
        >
          <Radio className="h-4 w-4 text-red-500 animate-pulse" />
          Live War Room Monitor
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Tab Sub-views */}
      {activeTab === 'hub' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Settings Form */}
          <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
            <h2 className="text-xl font-bold text-brand-text mb-4">Branding Configuration</h2>
            
            <form onSubmit={handleSaveHub} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1">Hub / Portal Name</label>
                <input
                  type="text"
                  required
                  value={hubName}
                  onChange={(e) => setHubName(e.target.value)}
                  placeholder="E.g., ACM Student Chapter, Tech Society"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm transition-all"
                  id="hub-name-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1">Primary Color Accent</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded border border-brand-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1">Secondary Color Accent</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded border border-brand-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-mono text-brand-text"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1">
                  ImgBB API Key (Optional)
                </label>
                <p className="text-xs text-brand-muted mb-1.5">
                  Allows storing logos on ImgBB. If left blank, converts file to preview-safe data URLs.
                </p>
                <input
                  type="password"
                  value={imgbbApiKey}
                  onChange={(e) => setImgbbApiKey(e.target.value)}
                  placeholder="Paste ImgBB Client API Key here"
                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm transition-all"
                  id="hub-imgbb-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-text mb-1">Upload Brand Logo</label>
                <div className="border-2 border-dashed border-brand-border rounded-xl p-6 text-center hover:border-brand-primary/50 transition-all">
                  <Upload className="h-8 w-8 text-brand-muted mx-auto mb-2" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload-file"
                  />
                  <label htmlFor="logo-upload-file" className="text-sm font-semibold text-brand-primary hover:underline cursor-pointer block">
                    {logoFile ? `Selected: ${logoFile.name}` : 'Choose a logo image file'}
                  </label>
                  <span className="text-xs text-brand-muted mt-1 block">Supports PNG, JPG, WebP up to 5MB</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={hubLoading}
                  className="bg-brand-primary text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                  id="hub-save-btn"
                >
                  {hubLoading ? 'Saving Branding...' : 'Save Hub Settings'}
                </button>
                {hubSuccess && (
                  <span className="text-green-600 font-bold text-sm flex items-center gap-1.5 animate-bounce">
                    <Check className="h-4 w-4" /> Saved successfully!
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Visual Hub Mockup Preview */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-brand-text mb-2">Live Preview</h2>
              <p className="text-xs text-brand-muted mb-6">How participants will see your micro-portal branding.</p>
              
              <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg">
                {/* Simulated Header */}
                <div className="p-3 bg-white flex items-center justify-between border-b border-brand-border" style={{ borderTop: `4px solid ${primaryColor}` }}>
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-200"></div>
                    )}
                    <span className="font-bold text-xs text-slate-800">{hubName || 'Your Hub Name'}</span>
                  </div>
                  <div className="w-12 h-4 rounded bg-slate-100"></div>
                </div>

                {/* Simulated content */}
                <div className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center border" style={{ borderColor: primaryColor }}>
                    <BookOpen className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="font-bold text-sm text-slate-800 mb-1">Interactive Competition Room</h3>
                  <p className="text-2xs text-slate-400 mb-4">Input Quiz code to unlock the proctored screen.</p>
                  
                  {/* Join buttons */}
                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <div className="h-7 rounded text-white text-2xs font-bold flex items-center justify-center shadow-xs" style={{ backgroundColor: primaryColor }}>
                      Enter Arena (Primary)
                    </div>
                    <div className="h-7 rounded border text-2xs font-bold flex items-center justify-center" style={{ borderColor: secondaryColor, color: secondaryColor }}>
                      Check Scores (Secondary)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-brand-border bg-slate-50/50 p-4 rounded-lg">
              <span className="text-xs block text-brand-muted font-bold mb-1">Your Hub ID Code:</span>
              <code className="text-sm font-mono block bg-brand-bg border p-2 rounded text-brand-primary select-all font-bold">
                {user?.uid}
              </code>
              <span className="text-2xs text-brand-muted mt-1.5 block">Share this ID code with participants so they can access your custom portal!</span>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'quizzes' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Left: Quiz Lists and creation */}
          <div className="space-y-6">
            
            {/* Create form */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
              <h2 className="text-lg font-bold text-brand-text mb-4">Create New Quiz</h2>
              <form onSubmit={handleCreateQuiz} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1">Quiz Title</label>
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="E.g., CS101 Midterm Quiz"
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm"
                    id="quiz-title-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1">Timer Limit (Mins)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="180"
                      value={quizTimeLimit}
                      onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-brand-text text-sm"
                      id="quiz-time-input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1">Pass % Requirement</label>
                    <input
                      type="number"
                      required
                      min="10"
                      max="100"
                      value={quizPassPercentage}
                      onChange={(e) => setQuizPassPercentage(Number(e.target.value))}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-brand-text text-sm"
                      id="quiz-pass-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={quizLoading}
                  className="w-full bg-brand-primary text-white font-bold text-sm py-2.5 rounded-lg hover:bg-opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  id="quiz-submit-btn"
                >
                  <Plus className="h-4 w-4" /> Create Quiz
                </button>
              </form>
            </div>

            {/* Quizzes List */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
              <h2 className="text-lg font-bold text-brand-text mb-4">Active Quizzes</h2>
              {quizzes.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-brand-border rounded-xl">
                  <p className="text-xs text-brand-muted">No quizzes created yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div 
                      key={quiz.id}
                      onClick={() => setSelectedQuiz(quiz)}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedQuiz?.id === quiz.id
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-brand-border hover:bg-brand-bg'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-extrabold text-sm text-brand-text">{quiz.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuiz(quiz.id);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-brand-border/40 text-2xs text-brand-muted font-medium">
                        <span>Time: {quiz.timeLimit} mins</span>
                        <span>Pass: {quiz.passPercentage}%</span>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQuizStatus(quiz, 'isActive');
                          }}
                          className={`text-2xs font-bold px-2 py-1 rounded border cursor-pointer ${
                            quiz.isActive 
                              ? 'bg-green-50 border-green-200 text-green-700' 
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          {quiz.isActive ? 'Active' : 'Draft'}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQuizStatus(quiz, 'isLiveCompetition');
                          }}
                          className={`text-2xs font-bold px-2 py-1 rounded border cursor-pointer ${
                            quiz.isLiveCompetition 
                              ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' 
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          {quiz.isLiveCompetition ? 'Live Comp' : 'Standard'}
                        </button>
                      </div>

                      <div className="mt-3 bg-brand-bg p-1.5 rounded text-3xs font-mono text-brand-muted truncate">
                        Link Code: {quiz.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right: Selected Quiz Questions Manager */}
          <div className="lg:col-span-2 space-y-6">
            {selectedQuiz ? (
              <div className="space-y-6">
                
                {/* Top overview banner */}
                <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-2xs text-brand-muted font-bold uppercase tracking-wider">Currently Editing</span>
                    <h3 className="text-xl font-black text-brand-text">{selectedQuiz.title}</h3>
                    <p className="text-xs text-brand-muted mt-1">
                      {questions.length} questions registered | Code: <code className="font-mono bg-brand-bg px-1 rounded text-brand-primary">{selectedQuiz.id}</code>
                    </p>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedQuiz.isLiveCompetition 
                        ? 'bg-red-100 text-red-800 animate-pulse border border-red-200' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {selectedQuiz.isLiveCompetition ? 'Live on War Room' : 'Standard Quiz'}
                    </span>
                  </div>
                </div>

                {/* CSV uploader & Manual Adder Forms */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Manual Question Form */}
                  <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                    <h4 className="text-sm font-extrabold text-brand-text mb-4">Add Question Manually</h4>
                    <form onSubmit={handleAddQuestion} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-brand-text mb-1">Question Statement</label>
                        <textarea
                          required
                          value={qText}
                          onChange={(e) => setQText(e.target.value)}
                          placeholder="Type your question statement here"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg p-2.5 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/50 outline-none h-16"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-brand-text">Multiple Choice Options</label>
                        <input
                          type="text"
                          required
                          value={qOptA}
                          onChange={(e) => setQOptA(e.target.value)}
                          placeholder="Option A (Index 0)"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-xs text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/50 outline-none"
                        />
                        <input
                          type="text"
                          required
                          value={qOptB}
                          onChange={(e) => setQOptB(e.target.value)}
                          placeholder="Option B (Index 1)"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-xs text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/50 outline-none"
                        />
                        <input
                          type="text"
                          required
                          value={qOptC}
                          onChange={(e) => setQOptC(e.target.value)}
                          placeholder="Option C (Index 2)"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-xs text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/50 outline-none"
                        />
                        <input
                          type="text"
                          required
                          value={qOptD}
                          onChange={(e) => setQOptD(e.target.value)}
                          placeholder="Option D (Index 3)"
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-1.5 text-xs text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/50 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-text mb-1">Correct Answer Index</label>
                        <select
                          value={qCorrect}
                          onChange={(e) => setQCorrect(Number(e.target.value))}
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-text"
                        >
                          <option value="0">Option A (Index 0)</option>
                          <option value="1">Option B (Index 1)</option>
                          <option value="2">Option C (Index 2)</option>
                          <option value="3">Option D (Index 3)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-primary text-white font-bold text-xs py-2 rounded-lg hover:bg-opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Append Question
                      </button>
                    </form>
                  </div>

                  {/* CSV Bulk Uploader */}
                  <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-brand-text mb-2">CSV Bulk Question Loader</h4>
                      <p className="text-xs text-brand-muted mb-4">
                        Format: <code className="font-mono bg-brand-bg p-0.5 rounded text-brand-primary text-2xs">Question, Opt1, Opt2, Opt3, Opt4, CorrectIndex(0-3)</code>. No headers.
                      </p>

                      <form onSubmit={handleCSVUpload} className="space-y-4">
                        <div className="border-2 border-dashed border-brand-border rounded-xl p-6 text-center">
                          <FileText className="h-8 w-8 text-brand-muted mx-auto mb-2" />
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setCsvFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                            id="csv-upload-input"
                          />
                          <label htmlFor="csv-upload-input" className="text-xs font-bold text-brand-primary hover:underline cursor-pointer block">
                            {csvFile ? `Loaded: ${csvFile.name}` : 'Select a .csv questions template'}
                          </label>
                        </div>

                        {csvError && (
                          <div className="p-3 bg-red-50 text-red-700 text-2xs rounded-lg border border-red-200">
                            {csvError}
                          </div>
                        )}

                        {csvSuccessCount !== null && (
                          <div className="p-3 bg-green-50 text-green-700 text-2xs rounded-lg border border-green-200">
                            Bulk loaded {csvSuccessCount} questions successfully!
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={!csvFile}
                          className="w-full bg-brand-primary text-white font-bold text-xs py-2 rounded-lg hover:bg-opacity-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Upload className="h-3 w-3" /> Execute CSV Parsing
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 bg-brand-bg p-3 rounded-lg border border-brand-border/60">
                      <span className="text-3xs block font-bold text-brand-muted uppercase tracking-wider mb-1">Example Row Content:</span>
                      <code className="text-3xs font-mono block break-all text-brand-text">
                        "What is 2+2?", "3", "4", "5", "6", 1
                      </code>
                    </div>
                  </div>

                </div>

                {/* Question List Preview */}
                <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                  <h4 className="text-sm font-extrabold text-brand-text mb-4">Questions Pool ({questions.length})</h4>
                  {questions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-brand-border rounded-xl">
                      <p className="text-xs text-brand-muted">No questions added yet. Use the manual form or CSV bulk uploader.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="border border-brand-border rounded-xl p-4 bg-brand-bg/40 relative">
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                            title="Remove Question"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          
                          <span className="text-xs font-bold text-brand-primary block mb-1">Question {idx + 1}</span>
                          <p className="text-sm font-semibold text-brand-text mb-3 pr-8">{q.text}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, oIdx) => (
                              <div 
                                key={oIdx} 
                                className={`text-xs px-3 py-1.5 rounded-lg border flex items-center justify-between ${
                                  q.correctOption === oIdx
                                    ? 'bg-green-50 border-green-300 text-green-800 font-bold'
                                    : 'bg-white border-brand-border text-brand-text'
                                }`}
                              >
                                <span>{opt}</span>
                                {q.correctOption === oIdx && <Check className="h-3 w-3 text-green-600" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center shadow-xs">
                <BookOpen className="h-12 w-12 text-brand-muted mx-auto mb-3" />
                <h3 className="text-lg font-bold text-brand-text mb-1">No Quiz Selected</h3>
                <p className="text-xs text-brand-muted">
                  Create or select an active quiz from the sidebar to configure its questions pool.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'warroom' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Top selection controller */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-brand-text flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                Live War Room Monitoring
              </h2>
              <p className="text-xs text-brand-muted mt-1">
                Select an active live competition below to monitor attempts in real time.
              </p>
            </div>

            <div>
              <select
                value={activeLiveQuizId}
                onChange={(e) => setActiveLiveQuizId(e.target.value)}
                className="bg-brand-bg border border-brand-border rounded-lg px-4 py-2 text-sm text-brand-text font-bold"
              >
                <option value="">-- Choose Live Quiz --</option>
                {liveQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
          </div>

          {activeLiveQuizId ? (
            <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 bg-slate-50 border-b border-brand-border flex justify-between items-center flex-wrap gap-2">
                <span className="text-sm font-black text-brand-text">Active Attempts Sync ({liveAttempts.length})</span>
                <span className="text-2xs bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Live Synced
                </span>
              </div>

              {liveAttempts.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <User className="h-12 w-12 text-brand-muted mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-brand-text mb-1">Waiting for Participants</h3>
                  <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                    Participants will appear here automatically using secure real-time sync when they enter the Quiz Arena.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-brand-bg border-b border-brand-border text-brand-muted font-bold text-xs uppercase tracking-wider">
                        <th className="px-6 py-3.5">Participant Details</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Score</th>
                        <th className="px-6 py-3.5">Time Consumed</th>
                        <th className="px-6 py-3.5">Cheat Logs (Proctoring Output)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {liveAttempts.map((attempt) => {
                        const seconds = attempt.timeSpentSeconds;
                        const min = Math.floor(seconds / 60);
                        const sec = seconds % 60;
                        const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

                        return (
                          <tr key={attempt.id} className="hover:bg-brand-bg/30 transition-colors">
                            <td className="px-6 py-4">
                              <div>
                                <span className="font-extrabold block text-brand-text">{attempt.userName}</span>
                                <span className="text-xs text-brand-muted block">{attempt.userEmail}</span>
                                <span className="text-2xs font-mono text-brand-muted block mt-0.5">CNIC: {attempt.userCnic}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${
                                attempt.status === 'Submitted'
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : attempt.status === 'Locked Out'
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                              }`}>
                                {attempt.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-brand-text">
                              {attempt.status === 'In Progress' ? '-' : `${attempt.score} Points`}
                              {attempt.status !== 'In Progress' && (
                                <span className={`block text-3xs font-black mt-1 uppercase ${attempt.passed ? 'text-green-600' : 'text-red-500'}`}>
                                  {attempt.passed ? 'Passed' : 'Failed'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-brand-text">
                              {timeStr}
                            </td>
                            <td className="px-6 py-4">
                              {attempt.cheatFlags.length === 0 ? (
                                <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                  <Check className="h-3.5 w-3.5" /> Normal / Secure
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 max-w-sm">
                                  {attempt.cheatFlags.map((flag, fIdx) => (
                                    <span 
                                      key={fIdx} 
                                      className="text-3xs bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded-md border border-red-200 flex items-center gap-1"
                                    >
                                      <ShieldAlert className="h-3 w-3 text-red-600 shrink-0" />
                                      {flag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center shadow-xs">
              <Radio className="h-12 w-12 text-brand-muted mx-auto mb-3" />
              <h3 className="text-lg font-bold text-brand-text mb-1">No Live Quiz Selected</h3>
              <p className="text-xs text-brand-muted max-w-md mx-auto">
                First toggle a quiz to "Live Comp" inside the "Quiz & Question Builder" tab, then select it in the controller above.
              </p>
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
};
