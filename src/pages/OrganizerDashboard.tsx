import React, { useState, useEffect, useRef } from 'react';
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
  updateDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion
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
  FileText,
  Calendar,
  Users,
  Clock,
  Lock,
  X,
  ChevronRight,
  AlertCircle,
  Filter,
  CheckCircle,
  HelpCircle,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface CsvQuestionRow {
  id: string;
  text: string;
  options: string[];
  correctOptionText: string;
  correctOptionIndex: number;
  isValid: boolean;
  validationMessage?: string;
}

export const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation tabs
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

  // Quiz General States
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTimeLimit, setQuizTimeLimit] = useState(15); // minutes
  const [quizPassPercentage, setQuizPassPercentage] = useState(50);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  // Quiz Constraints & Scheduling States
  const [totalAttemptsAllowed, setTotalAttemptsAllowed] = useState<number>(1);
  const [allowedCnicsInput, setAllowedCnicsInput] = useState<string>('');
  const [openAt, setOpenAt] = useState<string>('');
  const [closeAt, setCloseAt] = useState<string>('');
  const [postSubmissionText, setPostSubmissionText] = useState('');

  // Manual Question Form States
  const [qText, setQText] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState(0); // index 0-3
  const [questions, setQuestions] = useState<Question[]>([]);

  // CSV Upload Engine States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null);
  const [parsedCsvQuestions, setParsedCsvQuestions] = useState<CsvQuestionRow[]>([]);
  const [showCsvOverlay, setShowCsvOverlay] = useState(false);

  // Live War Room States
  const [liveQuizzes, setLiveQuizzes] = useState<Quiz[]>([]);
  const [activeLiveQuizId, setActiveLiveQuizId] = useState<string>('');
  const [liveAttempts, setLiveAttempts] = useState<Attempt[]>([]);

  // Feedback/Error States
  const [error, setError] = useState<string | null>(null);

  // Signatory States
  const [hubData, setHubData] = useState<any>(null);
  const [reportSignatoryName, setReportSignatoryName] = useState('');
  const [reportDesignation, setReportDesignation] = useState('FOUNDER');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Helper: Format ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
  const formatIsoForDatetimeLocal = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const handleDownloadRankedReport = async () => {
    if (!activeLiveQuizId) return;
    
    const activeQuizObj = quizzes.find(q => q.id === activeLiveQuizId);
    const quizTitle = activeQuizObj ? activeQuizObj.title : 'Quiz Event';

    try {
      setIsGeneratingReport(true);
      // 1. Fetch questions dynamically to get precise total questions count
      const qQuery = query(collection(db, 'questions'), where('quizId', '==', activeLiveQuizId));
      const questionsSnap = await getDocs(qQuery);
      const totalQuestions = questionsSnap.size || 10; // Fallback to 10 if none found

      const pointsPerQuestion = (activeQuizObj as any)?.pointsPerQuestion || 1;
      const totalPossible = (activeQuizObj as any)?.totalPossible || (totalQuestions * pointsPerQuestion);

      // 2. Filter & sort attempts: valid completions descending by score, ascending by timeSpentSeconds as tie-breaker
      let sortedAttempts = [...liveAttempts].filter(
        (attempt) => attempt.status === 'Submitted' || attempt.status === 'Locked Out'
      );

      // Fallback to all attempts if no completions are found, so report is never blank
      if (sortedAttempts.length === 0) {
        sortedAttempts = [...liveAttempts];
      }

      sortedAttempts.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.timeSpentSeconds - b.timeSpentSeconds;
      });

      // 3. Create the HTML layout for the report
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '800px';
      container.style.boxSizing = 'border-box';
      
      const primaryThemeColor = hubData?.primaryColor || primaryColor || '#0284c7';
      const secondaryThemeColor = hubData?.secondaryColor || secondaryColor || '#4f46e5';

      const rowsHtml = sortedAttempts.map((attempt, index) => {
        const rank = index + 1;
        const timeSpent = attempt.timeSpentSeconds;
        const timeStr = timeSpent ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` : '0m 0s';
        
        const correct = Math.round(attempt.score / pointsPerQuestion);
        const totalQuestionsOfQuiz = Math.round(totalPossible / pointsPerQuestion);
        const wrong = Math.max(0, totalQuestionsOfQuiz - correct);
        
        let rankBadgeStyle = 'color: #475569;';
        let rankText = `${rank}`;
        if (rank === 1) {
          rankBadgeStyle = 'color: #d97706; font-size: 15px; font-weight: 900;';
          rankText = '🥇 1';
        } else if (rank === 2) {
          rankBadgeStyle = 'color: #475569; font-size: 15px; font-weight: 900;';
          rankText = '🥈 2';
        } else if (rank === 3) {
          rankBadgeStyle = 'color: #b45309; font-size: 15px; font-weight: 900;';
          rankText = '🥉 3';
        }

        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 14px 10px; font-size: 13px; font-weight: 800; text-align: center; ${rankBadgeStyle}">
              ${rankText}
            </td>
            <td style="padding: 14px 10px;">
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${attempt.userName || 'N/A'}</div>
              <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 2px;">CNIC: ${attempt.userCnic || 'N/A'}</div>
            </td>
            <td style="padding: 14px 10px; font-size: 13px; color: #334155; text-align: center;">
              ${timeStr}
            </td>
            <td style="padding: 14px 10px; text-align: center;">
              <span style="font-size: 12px; font-weight: 700; color: #16a34a; background: #f0fdf4; padding: 2px 6px; border-radius: 4px;">${correct} Correct</span>
              <span style="font-size: 12px; font-weight: 700; color: #dc2626; background: #fef2f2; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${wrong} Wrong</span>
            </td>
            <td style="padding: 14px 10px; font-size: 14px; font-weight: 800; color: #0f172a; text-align: right;">
              ${attempt.score} / ${totalPossible}
            </td>
          </tr>
        `;
      }).join('');

      const logoElementRight = hubData?.logoUrl 
        ? `<img src="${hubData.logoUrl}" style="max-height: 48px; max-width: 180px; object-fit: contain;" referrerPolicy="no-referrer" />` 
        : `<span style="font-size: 28px; color: ${primaryThemeColor}">⚡</span>`;

      container.innerHTML = `
        <div style="padding: 45px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; box-sizing: border-box; border: 1px solid #e2e8f0;">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
            @font-face {
              font-family: 'Augustia';
              src: local('Augustia'), local('Great Vibes');
            }
          </style>

          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${primaryThemeColor}; padding-bottom: 24px; margin-bottom: 32px;">
            <div>
              <div style="font-size: 24px; font-weight: 900; color: ${primaryThemeColor}; letter-spacing: -0.05em;">
                ${hubData?.hubName || 'Event'}
              </div>
              <div style="font-size: 11px; font-weight: 800; color: ${secondaryThemeColor}; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 6px;">
                Ranked Event Scoreboard Report
              </div>
            </div>
            <div>
              ${logoElementRight}
            </div>
          </div>

          <!-- Metadata Summary Row -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 32px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 24px;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Event / Quiz Title</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${quizTitle}</div>
            </div>
            <div style="text-align: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Total Participants</div>
              <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${sortedAttempts.length}</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Total Questions</div>
              <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${Math.round(totalPossible / pointsPerQuestion)}</div>
            </div>
          </div>

          <!-- Table Header and Rows -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 48px; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                <th style="padding: 12px 10px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; width: 70px; text-align: center;">Rank</th>
                <th style="padding: 12px 10px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Full Name & CNIC</th>
                <th style="padding: 12px 10px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; width: 140px;">Time Consumed</th>
                <th style="padding: 12px 10px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; width: 160px;">Correct / Wrong</th>
                <th style="padding: 12px 10px; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 110px;">Total Score</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Digital Signature Section -->
          <div style="margin-top: 80px; border-top: 2px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: flex-end;">
            <div style="text-align: right; width: 320px;">
              <div style="font-family: 'Augustia', 'Great Vibes', 'Georgia', 'Times New Roman', serif; font-style: italic; font-size: 28px; color: ${primaryThemeColor}; margin-bottom: 6px; letter-spacing: 0.02em;">
                ${reportSignatoryName || 'Authorized Signature'}
              </div>
              <div style="font-size: 10px; font-weight: 900; color: #475569; letter-spacing: 0.15em; text-transform: uppercase;">
                ${reportDesignation || 'SIGNATORY DEPARTMENT / DESIGNATION'}
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // mm
      const pageHeight = 297; // mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeTitle = quizTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safeTitle}_Ranked_Report.pdf`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Error during PDF generation: ' + err.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handlePrintPaper = () => {
    window.print();
  };

  // 1. Initial Fetch (Hub, Quizzes)
  useEffect(() => {
    if (!user) return;
    
    const fetchHub = async () => {
      const path = `hubs/${user.uid}`;
      try {
        const hubDoc = await getDoc(doc(db, 'hubs', user.uid));
        if (hubDoc.exists()) {
          const data = hubDoc.data() as Hub;
          setHub(data);
          setHubData(data);
          setHubName(data.hubName);
          setLogoUrl(data.logoUrl);
          setPrimaryColor(data.primaryColor);
          setSecondaryColor(data.secondaryColor);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };

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

  // Sync constraints fields when a selected quiz changes
  useEffect(() => {
    if (selectedQuiz) {
      setTotalAttemptsAllowed(selectedQuiz.totalAttemptsAllowed ?? 1);
      setAllowedCnicsInput(selectedQuiz.allowedCnics ? selectedQuiz.allowedCnics.join(', ') : '');
      setOpenAt(formatIsoForDatetimeLocal(selectedQuiz.openAt));
      setCloseAt(formatIsoForDatetimeLocal(selectedQuiz.closeAt));
      setPostSubmissionText(selectedQuiz.postSubmissionText ?? '');
      
      // Fetch selected quiz questions
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
    } else {
      setQuestions([]);
    }
  }, [selectedQuiz]);

  // Sync Live war room listener when quiz selection updates
  useEffect(() => {
    if (!activeLiveQuizId || !user) {
      setLiveAttempts([]);
      return;
    }
    
    const path = `attempts for quiz ${activeLiveQuizId}`;
    const q = query(
      collection(db, 'attempts'),
      where('hubId', '==', user.uid),
      where('quizId', '==', activeLiveQuizId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attemptsList: Attempt[] = [];
      snapshot.forEach((docSnap) => {
        attemptsList.push(docSnap.data() as Attempt);
      });
      // Sort attempts: In progress first, then score descending, then by name
      attemptsList.sort((a, b) => {
        if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
        if (a.status !== 'In Progress' && b.status === 'In Progress') return 1;
        return b.score - a.score || a.userName.localeCompare(b.userName);
      });
      setLiveAttempts(attemptsList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [activeLiveQuizId, user]);

  // 2. Hub Branding Form Handlers
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
      setError(err.message || 'Failed to update Hub branding settings');
    } finally {
      setHubLoading(false);
    }
  };

  // 3. Quiz Management Handlers
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hub) {
      setError('Please configure and save your Hub Branding settings first before building quizzes.');
      return;
    }
    setQuizLoading(true);
    setError(null);

    const quizId = doc(collection(db, 'quizzes')).id;

    const newQuiz: Quiz = {
      id: quizId,
      hubId: hub.id,
      title: quizTitle.trim(),
      timeLimit: Number(quizTimeLimit),
      passPercentage: Number(quizPassPercentage),
      isActive: true,
      isLiveCompetition: false,
      createdAt: new Date().toISOString(),
      totalAttemptsAllowed: 1,
      allowedCnics: [],
      openAt: '',
      closeAt: '',
      postSubmissionText: postSubmissionText.trim()
    };

    try {
      await setDoc(doc(db, 'quizzes', quizId), newQuiz);
      setQuizzes((prev) => [newQuiz, ...prev]);
      setQuizTitle('');
      setPostSubmissionText('');
      setSelectedQuiz(newQuiz);
    } catch (err: any) {
      setError(err.message || 'Failed to construct a new quiz instance');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSaveConstraints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    setQuizLoading(true);
    setError(null);

    const parsedCnics = allowedCnicsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const updatedFields: Partial<Quiz> = {
      totalAttemptsAllowed: Number(totalAttemptsAllowed),
      allowedCnics: parsedCnics,
      openAt: openAt ? new Date(openAt).toISOString() : '',
      closeAt: closeAt ? new Date(closeAt).toISOString() : '',
      postSubmissionText: postSubmissionText.trim()
    };

    try {
      await updateDoc(doc(db, 'quizzes', selectedQuiz.id), updatedFields);
      
      const refreshedQuiz = {
        ...selectedQuiz,
        ...updatedFields
      };
      
      setQuizzes(prev => prev.map(q => q.id === selectedQuiz.id ? refreshedQuiz : q));
      setSelectedQuiz(refreshedQuiz);
      alert('SaaS scheduling rules and quiz constraints applied successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update scheduling rules');
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
    if (!window.confirm('Delete this Quiz instance? This will permanently remove its entire questions pool.')) return;
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

  // 4. Questions Manual Form Handlers
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    setError(null);

    const qId = doc(collection(db, 'questions')).id;
    const options = [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()];

    const newQuestion: Question = {
      id: qId,
      quizId: selectedQuiz.id,
      text: qText.trim(),
      options,
      correctOption: Number(qCorrect)
    };

    try {
      await setDoc(doc(db, 'questions', qId), newQuestion);
      setQuestions((prev) => [...prev, newQuestion]);
      setQText('');
      setQOptA('');
      setQOptB('');
      setQOptC('');
      setQOptD('');
      setQCorrect(0);
    } catch (err: any) {
      setError(err.message || 'Failed to append manual question');
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

  // 5. CSV Client-Side Parser Engine
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentValue.trim());
        if (row.length > 0 && row.some(val => val !== '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    if (currentValue || row.length > 0) {
      row.push(currentValue.trim());
      if (row.some(val => val !== '')) {
        lines.push(row);
      }
    }
    return lines;
  };

  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedQuiz) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);
      setCsvError(null);
      setCsvSuccessCount(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) {
          setCsvError('Failed to read file contents');
          return;
        }
        
        try {
          const rawRows = parseCSV(text);
          if (rawRows.length === 0) {
            setCsvError('No valid rows found in CSV');
            return;
          }
          
          // Header detection check
          const isHeader = (row: string[]) => {
            return row.some(cell => 
              cell.toLowerCase().includes('question text') || 
              cell.toLowerCase().includes('option a') ||
              cell.toLowerCase().includes('correct option text')
            );
          };
          
          if (rawRows.length > 0 && isHeader(rawRows[0])) {
            rawRows.shift(); // Remove headers
          }
          
          // Map to validation rows
          const parsed: CsvQuestionRow[] = rawRows.map((parts, idx) => {
            const questionText = parts[0] || '';
            const optA = parts[1] || '';
            const optB = parts[2] || '';
            const optC = parts[3] || '';
            const optD = parts[4] || '';
            const correctText = parts[5] || '';
            
            const options = [optA, optB, optC, optD];
            
            // Validate: Correct Option Text must match option items case-insensitively
            const foundIdx = options.findIndex(
              opt => opt.trim().toLowerCase() === correctText.trim().toLowerCase() && opt.trim() !== ''
            );
            
            const isValid = foundIdx !== -1;
            
            return {
              id: 'q_csv_' + crypto.randomUUID() + '_' + idx,
              text: questionText,
              options,
              correctOptionText: correctText,
              correctOptionIndex: foundIdx,
              isValid,
              validationMessage: isValid 
                ? undefined 
                : `Correct Option Text "${correctText}" fails to match any choice.`
            };
          });
          
          setParsedCsvQuestions(parsed);
          setShowCsvOverlay(true);
        } catch (err: any) {
          setCsvError(`CSV Parsing error: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  };

  // Re-evaluate validation state for a specific overlay row
  const validateSingleRow = (row: CsvQuestionRow): CsvQuestionRow => {
    const foundIdx = row.options.findIndex(
      opt => opt.trim().toLowerCase() === row.correctOptionText.trim().toLowerCase() && opt.trim() !== ''
    );
    const indexIsValid = row.correctOptionIndex >= 0 && row.correctOptionIndex <= 3;
    const finalValid = foundIdx !== -1 || indexIsValid;
    const finalIndex = foundIdx !== -1 ? foundIdx : row.correctOptionIndex;
    const finalText = foundIdx !== -1 ? row.correctOptionText : (row.options[row.correctOptionIndex] || '');

    return {
      ...row,
      correctOptionIndex: finalIndex,
      correctOptionText: finalText,
      isValid: finalValid,
      validationMessage: finalValid
        ? undefined
        : `Correct Option Text fails to match Option A, B, C, or D.`
    };
  };

  // Execute Batch Transactional Commit to Firestore
  const handleCommitCsvQuestions = async () => {
    if (!selectedQuiz) return;
    
    const invalidRowsCount = parsedCsvQuestions.filter(q => !q.isValid).length;
    if (invalidRowsCount > 0) {
      alert(`Cannot commit. Please correct the ${invalidRowsCount} mismatched rows first.`);
      return;
    }

    setQuizLoading(true);
    try {
      const batch = writeBatch(db);
      
      parsedCsvQuestions.forEach((row) => {
        const qDocRef = doc(db, 'questions', row.id);
        batch.set(qDocRef, {
          id: row.id,
          quizId: selectedQuiz.id,
          text: row.text,
          options: row.options,
          correctOption: row.correctOptionIndex
        });
      });
      
      await batch.commit();
      
      // Update local state pool
      const newQuestions: Question[] = parsedCsvQuestions.map(row => ({
        id: row.id,
        quizId: selectedQuiz.id,
        text: row.text,
        options: row.options,
        correctOption: row.correctOptionIndex
      }));
      
      setQuestions(prev => [...prev, ...newQuestions]);
      setCsvSuccessCount(newQuestions.length);
      setParsedCsvQuestions([]);
      setCsvFile(null);
      setShowCsvOverlay(false);
      alert(`SaaS Bulk Loader: successfully committed ${newQuestions.length} questions inside Firestore batch write!`);
    } catch (err: any) {
      setError(err.message || 'Transactional Firestore Batch Commit failed.');
    } finally {
      setQuizLoading(false);
    }
  };

  // 6. Proctor Incident Parser Utility
  const parseProctorFlag = (flag: string): string => {
    const timeRegex = /(?:at\s+)?(\d{1,2}:\d{2}:\d{2}(?:\s*[APM]{2})?)/i;
    const match = flag.match(timeRegex);
    const timestamp = match ? ` [${match[1]}]` : '';
    
    const lowerFlag = flag.toLowerCase();
    if (lowerFlag.includes('tab switched') || lowerFlag.includes('visibility hidden')) {
      return `Tab Focus Lost${timestamp}`;
    }
    if (lowerFlag.includes('exited fullscreen')) {
      return `Exited Fullscreen Mode${timestamp}`;
    }
    if (lowerFlag.includes('window focus lost') || lowerFlag.includes('window blur') || lowerFlag.includes('focus lost')) {
      return `Window Focus Lost${timestamp}`;
    }
    if (lowerFlag.includes('copy')) {
      return `Attempted Copy${timestamp}`;
    }
    if (lowerFlag.includes('paste')) {
      return `Attempted Paste${timestamp}`;
    }
    if (lowerFlag.includes('right click') || lowerFlag.includes('contextmenu') || lowerFlag.includes('context menu')) {
      return `Attempted Right Click${timestamp}`;
    }
    if (lowerFlag.includes('devtools') || lowerFlag.includes('inspect')) {
      return `Attempted DevTools Access${timestamp}`;
    }
    return flag;
  };

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-4 py-8 print:hidden">
      
      {/* SaaS Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-text flex items-center gap-3">
            <Layout className="h-8 w-8 text-brand-primary" />
            ArenaHub SaaS Console
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Enterprise assessment system with scheduling constraints, instant CSV parser, and live proctored war room streams.
          </p>
        </div>

        {hub && (
          <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-xs">
            <img 
              src={hub.logoUrl} 
              alt="Hub Logo" 
              className="w-10 h-10 rounded-lg object-contain bg-white border border-brand-border p-1" 
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-xs block text-brand-muted font-bold uppercase tracking-wider">Tenant Portal</span>
              <span className="text-sm font-extrabold text-brand-text">{hub.hubName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Switcher */}
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

      {/* Global Errors */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-red-800 text-sm font-medium flex items-center gap-2 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* SUB TAB VIEWPORT */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: HUB CONFIG */}
        {activeTab === 'hub' && (
          <motion.div 
            key="hub-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Branding Inputs */}
            <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
              <h2 className="text-xl font-bold text-brand-text mb-4">Branding & Tenancy</h2>
              
              <form onSubmit={handleSaveHub} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1">Organization / Hub Name</label>
                  <input
                    type="text"
                    required
                    value={hubName}
                    onChange={(e) => setHubName(e.target.value)}
                    placeholder="E.g., Virtual University, Allied Testing Service"
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/30 outline-none text-sm transition-all"
                    id="hub-name-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1">Primary Brand Accent</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-brand-border cursor-pointer bg-transparent"
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
                    <label className="block text-sm font-semibold text-brand-text mb-1">Secondary Brand Accent</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-brand-border cursor-pointer bg-transparent"
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
                  <label className="block text-sm font-semibold text-brand-text mb-1">ImgBB API Key (Optional)</label>
                  <p className="text-xs text-brand-muted mb-2">Used to store uploaded logos permanently. If empty, falls back to the default API key or local base64 previews.</p>
                  <input
                    type="password"
                    value={imgbbApiKey}
                    onChange={(e) => setImgbbApiKey(e.target.value)}
                    placeholder="ImgBB API Client Key"
                    className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/30 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1">Upload Portal Logo</label>
                  <div className="border-2 border-dashed border-brand-border rounded-xl p-6 text-center hover:border-brand-primary/30 transition-all">
                    <Upload className="h-8 w-8 text-brand-muted mx-auto mb-2" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                      id="logo-upload-file"
                    />
                    <label htmlFor="logo-upload-file" className="text-sm font-semibold text-brand-primary hover:underline cursor-pointer block">
                      {logoFile ? `Selected file: ${logoFile.name}` : 'Click here to choose a logo file'}
                    </label>
                    <span className="text-xs text-brand-muted mt-1 block">PNG, JPG, WebP images accepted</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={hubLoading}
                    className="bg-brand-primary text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-opacity-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                    id="hub-save-btn"
                  >
                    {hubLoading ? 'Saving Portal settings...' : 'Save Branding Configuration'}
                  </button>
                  {hubSuccess && (
                    <span className="text-green-600 font-bold text-sm flex items-center gap-1.5 animate-bounce">
                      <Check className="h-4 w-4" /> Branded successfully!
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Branded Portal Mockup */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-brand-text mb-1">Live Portal Preview</h2>
                <p className="text-xs text-brand-muted mb-6">Visual branding rendered dynamically on users' login gates.</p>
                
                <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg shadow-sm">
                  <div className="p-3 bg-white flex items-center justify-between border-b border-brand-border" style={{ borderTop: `4px solid ${primaryColor}` }}>
                    <div className="flex items-center gap-2">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo Preview" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-slate-200"></div>
                      )}
                      <span className="font-bold text-2xs text-slate-800 truncate max-w-[150px]">{hubName || 'Your Portal Name'}</span>
                    </div>
                    <div className="w-10 h-3 bg-slate-100 rounded"></div>
                  </div>

                  <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-50 border mx-auto mb-2 flex items-center justify-center" style={{ borderColor: primaryColor }}>
                      <BookOpen className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="font-extrabold text-xs text-slate-800 mb-0.5">Quiz Entry Room</h3>
                    <p className="text-[10px] text-slate-400 mb-3">Input your assessment code to authenticate</p>
                    
                    <div className="space-y-1 max-w-[180px] mx-auto">
                      <div className="h-6 rounded text-[10px] font-bold text-white flex items-center justify-center shadow-xs" style={{ backgroundColor: primaryColor }}>
                        Verify & Begin Exam
                      </div>
                      <div className="h-6 rounded text-[10px] border font-bold flex items-center justify-center" style={{ borderColor: secondaryColor, color: secondaryColor }}>
                        Disconnect Hub
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-brand-border bg-slate-50/50 p-4 rounded-lg">
                <span className="text-xs block text-brand-muted font-bold mb-1">Enterprise Hub ID Code:</span>
                <code className="text-xs font-mono block bg-brand-bg border p-2.5 rounded text-brand-primary select-all font-bold tracking-wider text-center">
                  {user?.uid}
                </code>
                <span className="text-[10px] text-brand-muted mt-2 block leading-relaxed">
                  Provide this precise SaaS key to participants so they can unlock your tenant portal, bypass global routing, and receive your color presets.
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: QUIZZES AND QUESTIONS BUILDER */}
        {activeTab === 'quizzes' && (
          <motion.div 
            key="quizzes-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column: Create Quiz & Lists */}
            <div className="space-y-6">
              
              {/* Creator Box */}
              <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                <h2 className="text-lg font-bold text-brand-text mb-4">Create New Quiz</h2>
                <form onSubmit={handleCreateQuiz} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1">Quiz Title</label>
                    <input
                      type="text"
                      required
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="E.g., Senior Systems Analyst Midterm"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/30 outline-none text-xs"
                      id="quiz-title-input"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">Limit (Mins)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="300"
                        value={quizTimeLimit}
                        onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs"
                        id="quiz-time-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">Target Score %</label>
                      <input
                        type="number"
                        required
                        min="10"
                        max="100"
                        value={quizPassPercentage}
                        onChange={(e) => setQuizPassPercentage(Number(e.target.value))}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs"
                        id="quiz-pass-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text mb-1">Post-Submission Message (Optional)</label>
                    <textarea
                      value={postSubmissionText}
                      onChange={(e) => setPostSubmissionText(e.target.value)}
                      placeholder="E.g., Your quiz has been submitted successfully. Custom results will be announced via email."
                      rows={2}
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/30 outline-none text-xs"
                      id="quiz-post-submission-text-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={quizLoading}
                    className="w-full bg-brand-primary text-white font-bold text-xs py-2 rounded-lg hover:bg-opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    id="quiz-submit-btn"
                  >
                    <Plus className="h-3.5 w-3.5" /> Initialize Quiz Instance
                  </button>
                </form>
              </div>

              {/* Quiz Selection List */}
              <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                <h2 className="text-lg font-bold text-brand-text mb-4">Quiz Inventories</h2>
                {quizzes.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-brand-border rounded-xl bg-brand-bg/20">
                    <p className="text-xs text-brand-muted">No quizzes constructed.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {quizzes.map((quiz) => (
                      <div 
                        key={quiz.id}
                        onClick={() => setSelectedQuiz(quiz)}
                        className={`border rounded-xl p-3.5 cursor-pointer transition-all relative ${
                          selectedQuiz?.id === quiz.id
                            ? 'border-brand-primary bg-brand-primary/5 shadow-xs'
                            : 'border-brand-border hover:bg-brand-bg'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-extrabold text-xs text-brand-text block truncate max-w-[150px]">{quiz.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuiz(quiz.id);
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5"
                            title="Delete Quiz"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-brand-border/40 text-[10px] text-brand-muted font-bold">
                          <span>{quiz.timeLimit} mins</span>
                          <span>Pass: {quiz.passPercentage}%</span>
                        </div>

                        <div className="flex gap-1.5 mt-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleQuizStatus(quiz, 'isActive');
                            }}
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer ${
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
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer ${
                              quiz.isLiveCompetition 
                                ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' 
                                : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}
                          >
                            {quiz.isLiveCompetition ? 'Live Comp' : 'Standard'}
                          </button>
                        </div>

                        <div className="mt-2.5 bg-brand-bg px-2 py-1 rounded text-[9px] font-mono text-brand-muted flex justify-between items-center">
                          <span className="truncate">Key: {quiz.id}</span>
                          <span className="shrink-0 font-bold text-brand-primary cursor-pointer hover:underline">Select</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Detail, Scheduling, CSV overlay trigger and Manual form */}
            <div className="lg:col-span-2 space-y-6">
              {selectedQuiz ? (
                <div className="space-y-6">
                  
                  {/* Selected Quiz Top Header info */}
                  <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">Active Configuration</span>
                      <h3 className="text-xl font-black text-brand-text">{selectedQuiz.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-brand-muted mt-1.5">
                        <span><strong>{questions.length}</strong> questions in pool</span>
                        <span>•</span>
                        <span>SaaS Key: <code className="font-mono bg-brand-bg px-1.5 py-0.5 rounded text-brand-primary font-bold">{selectedQuiz.id}</code></span>
                      </div>
                    </div>
                    
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      selectedQuiz.isLiveCompetition 
                        ? 'bg-red-100 text-red-800 animate-pulse border border-red-200' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {selectedQuiz.isLiveCompetition ? 'Live Feed Active' : 'Offline Sandbox'}
                    </span>
                  </div>

                  {/* FEATURE 1: QUIZ CONSTRAINTS & SCHEDULING RULES */}
                  <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                      <Calendar className="h-5 w-5 text-brand-primary" />
                      <div>
                        <h3 className="text-sm font-extrabold text-brand-text">Quiz Scheduling & Security Constraints</h3>
                        <p className="text-[10px] text-brand-muted">Set scheduling windows and define strict participant white-lists.</p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveConstraints} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-brand-text mb-1">Total Attempts Allowed</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            required
                            value={totalAttemptsAllowed}
                            onChange={(e) => setTotalAttemptsAllowed(Number(e.target.value))}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                          />
                          <p className="text-[9px] text-brand-muted mt-1">Limits participant start attempts using their unique ID.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-brand-text mb-1">Allowed CNICs (White-list)</label>
                          <textarea
                            value={allowedCnicsInput}
                            onChange={(e) => setAllowedCnicsInput(e.target.value)}
                            placeholder="E.g., 42101-1234567-3, 42101-9876543-1"
                            className="w-full bg-brand-bg border border-brand-border rounded-lg p-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none h-[42px] resize-none"
                          />
                          <p className="text-[9px] text-brand-muted mt-0.5">Comma-separated CNIC string list. Leave empty to allow any registrant.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-brand-text mb-1">Quiz Open Date & Time</label>
                          <input
                            type="datetime-local"
                            value={openAt}
                            onChange={(e) => setOpenAt(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                          />
                          <p className="text-[9px] text-brand-muted mt-1">Participants cannot begin before this instant.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-brand-text mb-1">Quiz Close Date & Time</label>
                          <input
                            type="datetime-local"
                            value={closeAt}
                            onChange={(e) => setCloseAt(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                          />
                          <p className="text-[9px] text-brand-muted mt-1">Access shuts down automatically after this instant.</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-text mb-1">Post-Submission Message (Optional)</label>
                        <textarea
                          value={postSubmissionText}
                          onChange={(e) => setPostSubmissionText(e.target.value)}
                          placeholder="E.g., Your quiz has been submitted successfully. Custom results will be announced via email."
                          rows={2}
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/30 outline-none text-xs"
                          id="edit-quiz-post-submission-text-input"
                        />
                        <p className="text-[9px] text-brand-muted mt-1">This message will be shown to participants on the blind result screen after submission.</p>
                      </div>

                      <button
                        type="submit"
                        className="bg-brand-primary hover:bg-opacity-95 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle className="h-4 w-4" /> Save Scheduling & Constraints
                      </button>
                    </form>
                  </div>

                  {/* Manual Question Form & CSV File Input */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Manual Question box */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                      <h4 className="text-xs font-black uppercase tracking-wider text-brand-text mb-3">Add Question Manually</h4>
                      <form onSubmit={handleAddQuestion} className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-brand-text mb-1">Question Statement</label>
                          <textarea
                            required
                            value={qText}
                            onChange={(e) => setQText(e.target.value)}
                            placeholder="Ask a clear concept..."
                            className="w-full bg-brand-bg border border-brand-border rounded-lg p-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none h-14 resize-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold text-brand-text">Option Text choices</label>
                          <input
                            type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)}
                            placeholder="Option A (Index 0)" className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                          />
                          <input
                            type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)}
                            placeholder="Option B (Index 1)" className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                          />
                          <input
                            type="text" required value={qOptC} onChange={(e) => setQOptC(e.target.value)}
                            placeholder="Option C (Index 2)" className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                          />
                          <input
                            type="text" required value={qOptD} onChange={(e) => setQOptD(e.target.value)}
                            placeholder="Option D (Index 3)" className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-brand-text mb-1">Correct Choice</label>
                          <select
                            value={qCorrect}
                            onChange={(e) => setQCorrect(Number(e.target.value))}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs text-brand-text"
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
                          <Plus className="h-3.5 w-3.5" /> Save to Question Pool
                        </button>
                      </form>
                    </div>

                    {/* FEATURE 2: BULK QUIZ CSV FILE SELECT */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-brand-text mb-2">CSV Bulk Question Loader</h4>
                        <p className="text-[10px] text-brand-muted leading-relaxed mb-4">
                          Upload massive datasets instantly. File columns must map exactly as: <br />
                          <code className="font-mono text-brand-primary font-bold text-3xs">Question Text, Option A, Option B, Option C, Option D, Correct Option Text</code>
                        </p>

                        <div className="border-2 border-dashed border-brand-border rounded-xl p-5 text-center bg-brand-bg/10 hover:border-brand-primary/30 transition-all">
                          <FileText className="h-7 w-7 text-brand-muted mx-auto mb-1.5" />
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCSVSelect}
                            className="hidden"
                            id="csv-bulk-select-input"
                          />
                          <label htmlFor="csv-bulk-select-input" className="text-xs font-bold text-brand-primary hover:underline cursor-pointer block">
                            {csvFile ? `Selected: ${csvFile.name}` : 'Click here to load CSV template'}
                          </label>
                          <span className="text-[9px] text-brand-muted mt-1 block">Launches Interactive Row Checker</span>
                        </div>

                        {csvError && (
                          <div className="p-2.5 mt-3 bg-red-50 text-red-700 text-3xs rounded-lg border border-red-200">
                            {csvError}
                          </div>
                        )}

                        {csvSuccessCount !== null && (
                          <div className="p-2.5 mt-3 bg-green-50 text-green-700 text-3xs rounded-lg border border-green-200">
                            Bulk parsed & uploaded {csvSuccessCount} items safely!
                          </div>
                        )}
                      </div>

                      <div className="mt-4 bg-brand-bg p-3 rounded-lg border border-brand-border/40 text-3xs text-brand-muted">
                        <strong className="block text-brand-text mb-1 font-bold">Standard CSV Row Pattern:</strong>
                        <code className="font-mono block leading-tight break-all">
                          "What is React?", "Framework", "Library", "Service", "Engine", "Library"
                        </code>
                      </div>
                    </div>

                  </div>

                  {/* Selected Quiz Questions List preview */}
                  <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-extrabold text-brand-text">Questions Pool Preview ({questions.length})</h4>
                      <button
                        onClick={handlePrintPaper}
                        className="px-3 py-1.5 bg-brand-primary text-white text-3xs font-extrabold rounded-lg flex items-center gap-1.5 hover:bg-opacity-90 transition-all cursor-pointer shadow-sm hover:shadow"
                        id="print-question-paper-btn"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print Question Paper</span>
                      </button>
                    </div>
                    {questions.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-brand-border rounded-xl bg-brand-bg/10">
                        <p className="text-xs text-brand-muted">No questions saved. Input manually or drag a CSV above.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                        {questions.map((q, qIdx) => (
                          <div key={q.id} className="border border-brand-border rounded-xl p-3.5 bg-brand-bg/30 relative">
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="absolute top-3.5 right-3.5 text-red-500 hover:text-red-700 p-0.5"
                              title="Delete Question"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            
                            <span className="text-[10px] font-black text-brand-primary block mb-1">Question {qIdx + 1}</span>
                            <p className="text-xs font-extrabold text-brand-text mb-2.5 pr-8">{q.text}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isCorrect = q.correctOption === oIdx;
                                return (
                                  <div 
                                    key={oIdx} 
                                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                                      isCorrect
                                        ? 'bg-green-50 border-green-300 text-green-800 font-bold'
                                        : 'bg-white border-brand-border text-brand-text'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isCorrect && <Check className="h-3 w-3 text-green-600" />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="bg-brand-card border border-brand-border rounded-2xl p-16 text-center shadow-xs">
                  <BookOpen className="h-10 w-10 text-brand-muted mx-auto mb-3" />
                  <h3 className="text-base font-bold text-brand-text mb-1">No Quiz Instance Selected</h3>
                  <p className="text-xs text-brand-muted">
                    Initialize a new quiz or choose an active card from the inventory list to manage properties and questions.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 3: LIVE WAR ROOM MONITOR (TELEMETRY MONITOR) */}
        {activeTab === 'warroom' && (
          <motion.div 
            key="warroom-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Top War Room Selection */}
            <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-brand-text flex items-center gap-2">
                  <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                  Live War Room Stream
                </h2>
                <p className="text-xs text-brand-muted mt-1">
                  Secure real-time dashboard streaming participant telemetry and auto-proctoring incident logs.
                </p>
              </div>

              <div>
                <select
                  value={activeLiveQuizId}
                  onChange={(e) => setActiveLiveQuizId(e.target.value)}
                  className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-bold text-brand-text"
                >
                  <option value="">-- Choose Live Quiz Feed --</option>
                  {liveQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Data Grid */}
            {activeLiveQuizId ? (
              <div className="space-y-6">
                {/* 📋 Report PDF Settings */}
                <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                  <h3 className="text-sm font-extrabold text-brand-text flex items-center gap-2 mb-4">
                    <span>📋</span> Report PDF Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">Authorized Signatory Name</label>
                      <input
                        type="text"
                        placeholder="e.g., M Aqeel Afzal"
                        value={reportSignatoryName}
                        onChange={(e) => setReportSignatoryName(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-semibold text-brand-text focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">Designation / Department</label>
                      <input
                        type="text"
                        placeholder="e.g., FOUNDER"
                        value={reportDesignation}
                        onChange={(e) => setReportDesignation(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-semibold text-brand-text focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex">
                    <button
                      onClick={handleDownloadRankedReport}
                      disabled={isGeneratingReport}
                      className="px-4 py-2 bg-brand-primary text-white text-xs font-extrabold rounded-lg flex items-center gap-2 hover:bg-opacity-90 transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      <span>📊</span> {isGeneratingReport ? 'Generating...' : 'Download Ranked Scoreboard (PDF)'}
                    </button>
                  </div>
                </div>

                <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-xs">
                
                <div className="px-6 py-4 bg-slate-50 border-b border-brand-border flex justify-between items-center flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-brand-text uppercase tracking-wider">Live Synchronized Sessions ({liveAttempts.length})</span>
                  <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Real-time Active
                  </span>
                </div>

                {liveAttempts.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <Users className="h-10 w-10 text-brand-muted mx-auto mb-2" />
                    <h3 className="text-base font-bold text-brand-text mb-1">Awaiting Participants</h3>
                    <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                      Candidates entering this proctored quiz via the ArenaGate will stream onto this dashboard instantly.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-bg border-b border-brand-border text-brand-muted font-bold text-[10px] uppercase tracking-wider">
                          <th className="px-6 py-3.5">Participant Details</th>
                          <th className="px-6 py-3.5">CNIC Identity</th>
                          <th className="px-6 py-3.5">Telemetry Status</th>
                          <th className="px-6 py-3.5">Current Score</th>
                          <th className="px-6 py-3.5">Total Time Consumed</th>
                          <th className="px-6 py-3.5">Proctor Incident Activity Log</th>
                          <th className="px-6 py-3.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {liveAttempts.map((attempt) => {
                          const seconds = attempt.timeSpentSeconds;
                          const min = Math.floor(seconds / 60);
                          const sec = seconds % 60;
                          const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

                          return (
                            <tr key={attempt.id} className="hover:bg-brand-bg/20 transition-colors">
                              <td className="px-6 py-4">
                                <div>
                                  <span className="font-extrabold text-brand-text block text-sm">{attempt.userName}</span>
                                  <span className="text-[10px] text-brand-muted block mt-0.5">{attempt.userEmail}</span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-4 font-mono font-semibold text-brand-text text-xs">
                                {attempt.userCnic}
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5 items-start">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    attempt.status === 'Submitted'
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : attempt.status === 'Locked Out'
                                      ? 'bg-red-50 border-red-200 text-red-700'
                                      : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                                  }`}>
                                    {attempt.status}
                                  </span>
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                    attempt.cameraStatus === 'Active'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                      : attempt.cameraStatus === 'No Hardware'
                                      ? 'bg-gray-100 border-gray-200 text-gray-600'
                                      : attempt.cameraStatus === 'Permission Denied'
                                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                                      : 'bg-slate-50 border-slate-200 text-slate-600'
                                  }`}>
                                    📷 {attempt.cameraStatus || 'Requesting...'}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 font-bold text-brand-text text-sm">
                                {attempt.status === 'In Progress' ? (
                                  <span className="text-brand-muted italic text-xs">Answering...</span>
                                ) : (
                                  <div>
                                    <span>{attempt.score} Points</span>
                                    <span className={`block text-[9px] font-black mt-0.5 uppercase ${attempt.passed ? 'text-green-600' : 'text-red-500'}`}>
                                      {attempt.passed ? 'Passed' : 'Failed'}
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-4 font-mono text-brand-text font-bold">
                                {timeStr}
                              </td>

                              <td className="px-6 py-4">
                                {attempt.cheatFlags.length === 0 ? (
                                  <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" /> Secure Environment
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {attempt.cheatFlags.map((flag, fIdx) => (
                                      <span 
                                        key={fIdx} 
                                        className="text-[9px] bg-red-100 text-red-800 font-black px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1"
                                      >
                                        <ShieldAlert className="h-2.5 w-2.5 text-red-600 shrink-0" />
                                        {parseProctorFlag(flag)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-4">
                                {attempt.status === 'In Progress' ? (
                                  <button
                                    onClick={async () => {
                                      if (confirm("Are you sure you want to terminate this student's exam?")) {
                                        try {
                                          await updateDoc(doc(db, 'attempts', attempt.id), { 
                                            forceLocked: true, 
                                            cheatFlags: arrayUnion('Manually Terminated by Admin') 
                                          });
                                        } catch (err: any) {
                                          console.error('Failed to terminate session:', err);
                                          alert('Error force-terminating session: ' + err.message);
                                        }
                                      }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 rounded text-[11px] shadow-xs cursor-pointer transition-colors"
                                  >
                                    Force Terminate
                                  </button>
                                ) : (
                                  <span className="text-brand-muted font-bold text-[11px]">Terminated</span>
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
              </div>
            ) : (
              <div className="bg-brand-card border border-brand-border rounded-2xl p-16 text-center shadow-xs">
                <Radio className="h-10 w-10 text-brand-muted mx-auto mb-3" />
                <h3 className="text-base font-bold text-brand-text mb-1">Awaiting War Room selection</h3>
                <p className="text-xs text-brand-muted max-w-sm mx-auto">
                  Activate "Live Comp" status on any quiz in the builder tab, then select it from the dropdown corner above to start receiving candidates' telemetry.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* FEATURE 2 INTERACTIVE FULLSCREEN OVERLAY DATA-TABLE */}
      <AnimatePresence>
        {showCsvOverlay && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-7xl h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Overlay Header */}
              <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-brand-bg/50">
                <div>
                  <h3 className="text-base font-black text-brand-text flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brand-primary" />
                    ArenaHub SaaS Bulk CSV Parser
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-brand-muted mt-1">
                    <span>Parsed: <strong>{parsedCsvQuestions.length}</strong> items</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold text-red-600">
                      Mismatches needing repair: <strong>{parsedCsvQuestions.filter(q => !q.isValid).length}</strong>
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => { setShowCsvOverlay(false); setCsvFile(null); }}
                  className="p-1 rounded-full text-brand-muted hover:bg-brand-bg transition-all cursor-pointer"
                  title="Close Overlay"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Overlay Interactive Grid Body */}
              <div className="flex-1 overflow-auto p-6">
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs mb-4 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block">Row validation logic in progress:</span>
                    For each question, the 'Correct Option Text' column must match exactly one of the four Option columns. Highlighted rows indicate mismatches. You can adjust the text choices, question text, or select the Correct Option dropdown in-place below to resolve errors instantly before executing the transaction commit!
                  </div>
                </div>

                <div className="border border-brand-border rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-bg border-b border-brand-border text-brand-muted font-bold text-[10px] uppercase tracking-wider">
                        <th className="px-4 py-2 w-[50px] text-center">Row</th>
                        <th className="px-4 py-2 min-w-[200px]">Question Text</th>
                        <th className="px-4 py-2 min-w-[120px]">Option A</th>
                        <th className="px-4 py-2 min-w-[120px]">Option B</th>
                        <th className="px-4 py-2 min-w-[120px]">Option C</th>
                        <th className="px-4 py-2 min-w-[120px]">Option D</th>
                        <th className="px-4 py-2 min-w-[160px]">Correct Option Check</th>
                        <th className="px-4 py-2 w-[110px] text-center">Status</th>
                        <th className="px-4 py-2 w-[60px] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {parsedCsvQuestions.map((row, idx) => (
                        <tr 
                          key={row.id} 
                          className={`transition-colors ${
                            row.isValid 
                              ? 'hover:bg-brand-bg/10' 
                              : 'bg-red-50/40 hover:bg-red-50/60 text-red-950'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-center font-bold text-brand-muted">
                            {idx + 1}
                          </td>

                          {/* Editable Question Text */}
                          <td className="px-3 py-3">
                            <textarea
                              value={row.text}
                              onChange={(e) => {
                                const newText = e.target.value;
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ ...r, text: newText }) : r
                                ));
                              }}
                              className="w-full bg-transparent border-b border-brand-border/40 text-xs focus:border-brand-primary focus:outline-none p-1 resize-none h-12"
                            />
                          </td>

                          {/* Editable Option A */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.options[0]}
                              onChange={(e) => {
                                const newOpt = e.target.value;
                                const newOpts = [newOpt, row.options[1], row.options[2], row.options[3]];
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ ...r, options: newOpts }) : r
                                ));
                              }}
                              className="w-full bg-transparent border-b border-brand-border/40 text-xs focus:border-brand-primary focus:outline-none p-1"
                            />
                          </td>

                          {/* Editable Option B */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.options[1]}
                              onChange={(e) => {
                                const newOpt = e.target.value;
                                const newOpts = [row.options[0], newOpt, row.options[2], row.options[3]];
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ ...r, options: newOpts }) : r
                                ));
                              }}
                              className="w-full bg-transparent border-b border-brand-border/40 text-xs focus:border-brand-primary focus:outline-none p-1"
                            />
                          </td>

                          {/* Editable Option C */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.options[2]}
                              onChange={(e) => {
                                const newOpt = e.target.value;
                                const newOpts = [row.options[0], row.options[1], newOpt, row.options[3]];
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ ...r, options: newOpts }) : r
                                ));
                              }}
                              className="w-full bg-transparent border-b border-brand-border/40 text-xs focus:border-brand-primary focus:outline-none p-1"
                            />
                          </td>

                          {/* Editable Option D */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.options[3]}
                              onChange={(e) => {
                                const newOpt = e.target.value;
                                const newOpts = [row.options[0], row.options[1], row.options[2], newOpt];
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ ...r, options: newOpts }) : r
                                ));
                              }}
                              className="w-full bg-transparent border-b border-brand-border/40 text-xs focus:border-brand-primary focus:outline-none p-1"
                            />
                          </td>

                          {/* Editable Correct Option Dropdown */}
                          <td className="px-3 py-3">
                            <select
                              value={row.correctOptionIndex}
                              onChange={(e) => {
                                const newIdx = parseInt(e.target.value, 10);
                                const newText = row.options[newIdx] || '';
                                setParsedCsvQuestions(prev => prev.map(r => 
                                  r.id === row.id ? validateSingleRow({ 
                                    ...r, 
                                    correctOptionIndex: newIdx, 
                                    correctOptionText: newText 
                                  }) : r
                                ));
                              }}
                              className="bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-xs text-brand-text w-full focus:ring-1 focus:ring-brand-primary/40 outline-none font-medium"
                            >
                              <option value="-1">-- Mismatch Error --</option>
                              <option value="0">A: {row.options[0] || '(empty)'}</option>
                              <option value="1">B: {row.options[1] || '(empty)'}</option>
                              <option value="2">C: {row.options[2] || '(empty)'}</option>
                              <option value="3">D: {row.options[3] || '(empty)'}</option>
                            </select>
                          </td>

                          {/* Validation Status column */}
                          <td className="px-4 py-3 text-center">
                            {row.isValid ? (
                              <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                                <Check className="h-3.5 w-3.5 shrink-0" /> Ready
                              </span>
                            ) : (
                              <span className="text-red-600 font-extrabold flex items-center justify-center gap-1 animate-pulse" title={row.validationMessage}>
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Mismatch
                              </span>
                            )}
                          </td>

                          {/* Action - Delete single row */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setParsedCsvQuestions(prev => prev.filter(r => r.id !== row.id));
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                              title="Delete Row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overlay Footer */}
              <div className="px-6 py-4 border-t border-brand-border flex items-center justify-between bg-brand-bg/50">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowCsvOverlay(false); setCsvFile(null); }}
                    className="border border-brand-border bg-white text-brand-text text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-brand-bg transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={() => {
                      const newRowId = 'q_csv_' + crypto.randomUUID() + '_manual';
                      const newRow: CsvQuestionRow = {
                        id: newRowId,
                        text: 'New Question statement',
                        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
                        correctOptionText: 'Choice A',
                        correctOptionIndex: 0,
                        isValid: true
                      };
                      setParsedCsvQuestions(prev => [...prev, newRow]);
                    }}
                    className="border border-brand-border bg-slate-100 text-brand-text text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 transition-all flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Question Row
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {parsedCsvQuestions.filter(q => !q.isValid).length > 0 && (
                    <span className="text-xs text-red-600 font-bold flex items-center gap-1 animate-bounce">
                      <AlertCircle className="h-4 w-4" /> Correct highlighted mismatch items first
                    </span>
                  )}
                  
                  <button
                    onClick={handleCommitCsvQuestions}
                    disabled={parsedCsvQuestions.filter(q => !q.isValid).length > 0 || parsedCsvQuestions.length === 0}
                    className="bg-brand-accent text-white text-xs font-extrabold px-6 py-2.5 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm hover:bg-opacity-95"
                  >
                    <CheckCircle className="h-4 w-4" /> Commit Batch Transaction
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>

      {/* Print Wrapper */}
      {selectedQuiz && (
        <div className="hidden print:block absolute inset-0 bg-white text-black p-8 z-[9999] min-h-screen">
          {/* Header */}
          <div className="flex justify-between items-center pb-6 border-b-2 border-black mb-8">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-black">
                {hubData?.hubName || hub?.hubName || hubName || 'Institution / Event'}
              </h1>
              <h2 className="text-2xl font-black text-black mt-2">
                {selectedQuiz.title}
              </h2>
              <p className="text-sm text-gray-700 mt-1">
                Official Question Paper - Total Questions: {questions.length} - Time: {selectedQuiz.timeLimit || 0} mins
              </p>
            </div>
            {(hubData?.logoUrl || hub?.logoUrl || logoUrl) && (
              <img
                src={hubData?.logoUrl || hub?.logoUrl || logoUrl}
                alt="Institution Logo"
                className="h-16 max-w-[200px] object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Questions List */}
          <div className="space-y-6">
            {questions.map((q, qIndex) => (
              <div key={q.id || qIndex} className="break-inside-avoid">
                <p className="font-bold text-base text-black mb-2">
                  Q{qIndex + 1}. {q.text}
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-6">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="text-sm text-gray-800">
                      <span className="font-semibold mr-1">{String.fromCharCode(65 + oIdx)})</span>
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Answer Key Page Break */}
          <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="mt-12 pt-8 border-t-2 border-dashed border-gray-300">
            <h2 className="text-xl font-bold text-black border-b border-black pb-2 mb-6">
              Official Answer Key - {selectedQuiz.title}
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {questions.map((q, qIndex) => (
                <div key={q.id || qIndex} className="text-sm text-gray-800 flex items-start gap-1">
                  <span className="font-bold whitespace-nowrap">Q{qIndex + 1}:</span>
                  <span>
                    Option <span className="font-bold text-black">{String.fromCharCode(65 + q.correctOption)}</span> - {q.options[q.correctOption]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
