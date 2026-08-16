import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
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
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { uploadToImgBB } from "../utils/upload";
import { Hub, Quiz, Question, Attempt } from "../types";
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
  Printer,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createRoot } from "react-dom/client";
import html2pdf from "html2pdf.js";
import { PrintableReport } from "../components/PrintableReport";
import { PrintableQuestionPaper } from "../components/PrintableQuestionPaper";
import { PrintableScoreboard } from "../components/PrintableScoreboard";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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
  const [activeTab, setActiveTab] = useState<"hub" | "quizzes" | "warroom">(
    "hub",
  );

  // Hub States
  const [hub, setHub] = useState<Hub | null>(null);
  const [hubName, setHubName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#4f46e5");
  const [imgbbApiKey, setImgbbApiKey] = useState("");
  const [hubLoading, setHubLoading] = useState(false);
  const [hubSuccess, setHubSuccess] = useState(false);

  // Quiz General States
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizTimeLimit, setQuizTimeLimit] = useState(15); // minutes
  const [quizPassPercentage, setQuizPassPercentage] = useState(50);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  // Quiz Constraints & Scheduling States
  const [totalAttemptsAllowed, setTotalAttemptsAllowed] = useState<number>(1);
  const [allowedCnics, setAllowedCnics] = useState<string[]>([]);
  const [cnicInputValue, setCnicInputValue] = useState("");
  const [cnicImportFeedback, setCnicImportFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const cnicCsvInputRef = useRef<HTMLInputElement>(null);
  const [openAt, setOpenAt] = useState<string>("");
  const [closeAt, setCloseAt] = useState<string>("");
  const [isPerQuestionTimer, setIsPerQuestionTimer] = useState(false);
  const [timePerQuestionSeconds, setTimePerQuestionSeconds] = useState(15);
  const [postSubmissionText, setPostSubmissionText] = useState("");

  // Manual Question Form States
  const [qText, setQText] = useState("");
  const [qOptA, setQOptA] = useState("");
  const [qOptB, setQOptB] = useState("");
  const [qOptC, setQOptC] = useState("");
  const [qOptD, setQOptD] = useState("");
  const [qCorrect, setQCorrect] = useState(0); // index 0-3
  const [qImageUrl, setQImageUrl] = useState("");
  const [isUploadingQImage, setIsUploadingQImage] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);

  // CSV Upload Engine States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null);
  const [parsedCsvQuestions, setParsedCsvQuestions] = useState<
    CsvQuestionRow[]
  >([]);
  const [showCsvOverlay, setShowCsvOverlay] = useState(false);

  // Live War Room States
  const [liveQuizzes, setLiveQuizzes] = useState<Quiz[]>([]);
  const [activeLiveQuizId, setActiveLiveQuizId] = useState<string>("");
  const [liveAttempts, setLiveAttempts] = useState<Attempt[]>([]);

  // Feedback/Error States
  const [error, setError] = useState<string | null>(null);

  // Signatory States
  const [hubData, setHubData] = useState<any>(null);
  const [reportSignatoryName, setReportSignatoryName] = useState("");
  const [reportDesignation, setReportDesignation] = useState("FOUNDER");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDownloadingPaper, setIsDownloadingPaper] = useState(false);
  const [isDownloadingAudit, setIsDownloadingAudit] = useState(false);

  // Audit States
  const [auditAttempt, setAuditAttempt] = useState<Attempt | null>(null);
  const [auditQuestions, setAuditQuestions] = useState<Question[]>([]);
  const [auditSecureAnswers, setAuditSecureAnswers] = useState<
    Record<string, string>
  >({});
  const [isFetchingAudit, setIsFetchingAudit] = useState(false);

  // Helper: Format ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
  const formatIsoForDatetimeLocal = (isoString?: string): string => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "";
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
      return "";
    }
  };

  const formatForensicTime = (isoString?: string): string => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const handleDownloadRankedReport = async () => {
    if (!activeLiveQuizId) return;
    setIsGeneratingReport(true);

    try {
      // Create a temporary container
      const container = document.createElement("div");
      container.id =
        "printable-paper-content-" + Math.random().toString(36).substring(7);
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "800px";
      container.style.minHeight = "297mm";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#000000";
      container.style.zIndex = "-9999";
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableScoreboard
          quizTitle={
            quizzes.find((q) => q.id === activeLiveQuizId)?.title ||
            "Unknown Quiz"
          }
          hubName={hubData?.hubName || hub?.hubName || hubName || "Event"}
          logoUrl={hubData?.logoUrl || hub?.logoUrl}
          attempts={[...liveAttempts].sort((a, b) => b.score - a.score)}
          reportSignatoryName={reportSignatoryName}
          reportDesignation={reportDesignation}
          primaryThemeColor={hubData?.primaryColor || primaryColor || "#ea580c"}
        />,
      );

      // Give React time to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Temporarily scroll to top to prevent capture clipping
      const originalScroll = window.scrollY;
      window.scrollTo(0, 0);

      // Wait for DOM & images to settle
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: true,
        });
        // 🛑 Clean Safety Check (Fixed Syntax Error)
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          console.error(
            "Canvas width or height is 0px. Aborting PDF generation.",
          );
          window.scrollTo(0, originalScroll);
          return;
        }

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(
          `${(quizzes.find((q) => q.id === activeLiveQuizId)?.title || "report").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_Ranked_Report.pdf`,
        );
      } catch (error) {
        console.error("PDF Generation Error:", error);
      } finally {
        window.scrollTo(0, originalScroll); // Restore scroll position
      }
      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      alert("Error during PDF generation: " + err.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadQuestionPaper = async () => {
    if (!selectedQuiz) return;
    setIsDownloadingPaper(true);
    try {
      // Create a temporary container
      const container = document.createElement("div");
      container.id =
        "printable-paper-content-" + Math.random().toString(36).substring(7);
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "800px";
      container.style.minHeight = "297mm";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#000000";
      container.style.zIndex = "-9999";
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableQuestionPaper
          questions={questions}
          hubName={hubData?.hubName || hub?.hubName || hubName || "Event"}
          logoUrl={hubData?.logoUrl || hub?.logoUrl}
          quizTitle={selectedQuiz.title}
          timeLimit={selectedQuiz.timeLimit || 0}
        />,
      );

      // Give React time to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Temporarily scroll to top to prevent capture clipping
      const originalScroll = window.scrollY;
      window.scrollTo(0, 0);

      // Wait for DOM & images to settle
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: true,
        });
        // 🛑 Clean Safety Check (Fixed Syntax Error)
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          console.error(
            "Canvas width or height is 0px. Aborting PDF generation.",
          );
          window.scrollTo(0, originalScroll);
          return;
        }

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(
          `${selectedQuiz.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_Question_Paper.pdf`,
        );
      } catch (error) {
        console.error("PDF Generation Error:", error);
      } finally {
        window.scrollTo(0, originalScroll); // Restore scroll position
      }
      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error("PDF Question Paper generation error:", err);
      alert("Error during PDF Question Paper generation: " + err.message);
    } finally {
      setIsDownloadingPaper(false);
    }
  };

  const handleDownloadAuditPDF = async () => {
    if (!auditAttempt) return;
    setIsDownloadingAudit(true);
    try {
      // Create a temporary container
      const container = document.createElement("div");
      container.id =
        "printable-paper-content-" + Math.random().toString(36).substring(7);
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "800px";
      container.style.minHeight = "297mm";
      container.style.backgroundColor = "#ffffff";
      container.style.color = "#000000";
      container.style.zIndex = "-9999";
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableReport
          attempt={auditAttempt}
          questions={auditQuestions}
          hubName={hubData?.hubName || hub?.hubName || hubName || "Event"}
          logoUrl={hubData?.logoUrl || hub?.logoUrl}
        />,
      );

      // Give React time to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Temporarily scroll to top to prevent capture clipping
      const originalScroll = window.scrollY;
      window.scrollTo(0, 0);

      // Wait for DOM & images to settle
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: true,
        });
        // 🛑 Clean Safety Check (Fixed Syntax Error)
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          console.error(
            "Canvas width or height is 0px. Aborting PDF generation.",
          );
          window.scrollTo(0, originalScroll);
          return;
        }

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`${auditAttempt.userId}_Forensic_Audit.pdf`);
      } catch (error) {
        console.error("PDF Generation Error:", error);
      } finally {
        window.scrollTo(0, originalScroll); // Restore scroll position
      }
      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error("PDF Audit Report generation error:", err);
      alert("Error during PDF Audit Report generation: " + err.message);
    } finally {
      setIsDownloadingAudit(false);
    }
  };

  const handleViewAudit = async (attempt: Attempt) => {
    setIsFetchingAudit(true);
    try {
      // 1. Fetch the questions for this quiz from the hub document
      let qList: Question[] = [];
      try {
        if (hubData) {
          const hubDoc = await getDoc(doc(db, "hubs", hubData.id));
          if (hubDoc.exists()) {
            const fetchedHub = hubDoc.data() as Hub;
            const allQuestions = fetchedHub.questions || [];
            qList = allQuestions.filter((q) => q.quizId === attempt.quizId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch from hub questions", err);
      }

      // 2. Fetch the secure answer key: getDoc(doc(db, 'quizzes_secure_answers', attempt.quizId))
      const secureAnswers: Record<string, string> = {};
      try {
        const secureSnap = await getDoc(
          doc(db, "quizzes_secure_answers", attempt.quizId),
        );
        if (secureSnap.exists()) {
          const secureData = secureSnap.data();
          const answersMap = secureData.answers || secureData || {};
          Object.keys(answersMap).forEach((key) => {
            secureAnswers[key] = String(answersMap[key]);
          });
        }
      } catch (err) {
        console.warn("Failed to fetch quizzes_secure_answers", err);
      }

      // Fallback: use correctOption on question if not in secureAnswers
      qList.forEach((q) => {
        if (q.id && secureAnswers[q.id] === undefined) {
          secureAnswers[q.id] = String(q.correctOption);
        }
      });

      setAuditQuestions(qList);
      setAuditSecureAnswers(secureAnswers);
      setAuditAttempt(attempt);
    } catch (err: any) {
      console.error("Error fetching audit data:", err);
      alert("Failed to retrieve student attempt details: " + err.message);
    } finally {
      setIsFetchingAudit(false);
    }
  };

  // 1. Initial Fetch (Hub, Quizzes)
  useEffect(() => {
    if (!user) return;

    const fetchHub = async () => {
      const path = `hubs/${user.uid}`;
      try {
        const hubDoc = await getDoc(doc(db, "hubs", user.uid));
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
      const path = "quizzes";
      try {
        const q = query(
          collection(db, "quizzes"),
          where("hubId", "==", user.uid),
        );
        const querySnapshot = await getDocs(q);
        const quizList: Quiz[] = [];
        querySnapshot.forEach((docSnap) => {
          quizList.push(docSnap.data() as Quiz);
        });
        setQuizzes(quizList);
        setLiveQuizzes(quizList.filter((quiz) => quiz.isLiveCompetition));
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
      setAllowedCnics(selectedQuiz.allowedCnics || []);
      setCnicInputValue("");
      setCnicImportFeedback(null);
      setOpenAt(formatIsoForDatetimeLocal(selectedQuiz.openAt));
      setCloseAt(formatIsoForDatetimeLocal(selectedQuiz.closeAt));
      setPostSubmissionText(selectedQuiz.postSubmissionText ?? "");
      setIsPerQuestionTimer(selectedQuiz.perQuestionTimer || false);
      setTimePerQuestionSeconds(selectedQuiz.timePerQuestionSeconds || 15);
      setQuizTimeLimit(selectedQuiz.timeLimit || 15);

      // Fetch selected quiz questions
      const fetchQuestions = async () => {
        if (!hub) return;
        const path = `hubs/${hub.id}`;
        try {
          const hubDoc = await getDoc(doc(db, "hubs", hub.id));
          if (hubDoc.exists()) {
            const hubData = hubDoc.data() as Hub;
            const allQuestions = hubData.questions || [];
            // Filter questions for the selected quiz
            const qList = allQuestions.filter(
              (q) => q.quizId === selectedQuiz.id,
            );
            setQuestions(qList);
          } else {
            setQuestions([]);
          }
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
      collection(db, "attempts"),
      where("hubId", "==", user.uid),
      where("quizId", "==", activeLiveQuizId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const attemptsList: Attempt[] = [];
        snapshot.forEach((docSnap) => {
          attemptsList.push(docSnap.data() as Attempt);
        });
        // Sort attempts: In progress first, then score descending, then by name
        attemptsList.sort((a, b) => {
          if (a.status === "In Progress" && b.status !== "In Progress")
            return -1;
          if (a.status !== "In Progress" && b.status === "In Progress")
            return 1;
          return b.score - a.score || a.userName.localeCompare(b.userName);
        });
        setLiveAttempts(attemptsList);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      },
    );

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
        logoUrl:
          finalLogoUrl ||
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150",
        primaryColor,
        secondaryColor,
        createdAt: hub?.createdAt || new Date().toISOString(),
      };

      await setDoc(doc(db, "hubs", user.uid), hubData);
      setHub(hubData);
      setLogoUrl(finalLogoUrl);
      setHubSuccess(true);
      setTimeout(() => setHubSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update Hub branding settings");
    } finally {
      setHubLoading(false);
    }
  };

  // 3. Quiz Management Handlers
  const generateJoinCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const chars = Array.from({length: 3}, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    const nums = Math.floor(100 + Math.random() * 900); // 3 digit number
    return `${chars}${nums}`; // Example: ABC123
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hub) {
      setError(
        "Please configure and save your Hub Branding settings first before building quizzes.",
      );
      return;
    }
    setQuizLoading(true);
    setError(null);

    const quizId = doc(collection(db, "quizzes")).id;
    const joinCode = generateJoinCode();

    const newQuiz: Quiz = {
      id: quizId,
      hubId: hub.id,
      joinCode,
      title: quizTitle.trim(),
      passPercentage: Number(quizPassPercentage),
      isActive: true,
      isLiveCompetition: false,
      createdAt: new Date().toISOString(),
      totalAttemptsAllowed: 1,
      allowedCnics: [],
      openAt: "",
      closeAt: "",
      postSubmissionText: postSubmissionText.trim(),
      perQuestionTimer: isPerQuestionTimer,
      timePerQuestionSeconds: isPerQuestionTimer
        ? Number(timePerQuestionSeconds)
        : null,
      timeLimit: !isPerQuestionTimer ? Number(quizTimeLimit) : 0,
    };

    try {
      await setDoc(doc(db, "quizzes", quizId), newQuiz);
      setQuizzes((prev) => [newQuiz, ...prev]);
      setQuizTitle("");
      setPostSubmissionText("");
      setSelectedQuiz(newQuiz);
    } catch (err: any) {
      setError(err.message || "Failed to construct a new quiz instance");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleCnicInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (value.includes(",")) {
      const newCnic = value.replace(/,/g, "").trim();
      const digits = newCnic.replace(/\D/g, "").substring(0, 13);
      let formatted = "";
      if (digits.length > 0) formatted += digits.substring(0, 5);
      if (digits.length > 5) formatted += "-" + digits.substring(5, 12);
      if (digits.length > 12) formatted += "-" + digits.substring(12, 13);

      const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
      if (cnicRegex.test(formatted) && !allowedCnics.includes(formatted)) {
        setAllowedCnics((prev) => [...prev, formatted]);
        setCnicInputValue("");
      } else {
        setCnicInputValue(formatted);
      }
    } else {
      const digits = value.replace(/\D/g, "").substring(0, 13);
      let formatted = "";
      if (digits.length > 0) formatted += digits.substring(0, 5);
      if (digits.length > 5) formatted += "-" + digits.substring(5, 12);
      if (digits.length > 12) formatted += "-" + digits.substring(12, 13);
      setCnicInputValue(formatted);
    }
  };

  const handleCnicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Stop the form from submitting!

      const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
      if (
        cnicRegex.test(cnicInputValue) &&
        !allowedCnics.includes(cnicInputValue)
      ) {
        setAllowedCnics([...allowedCnics, cnicInputValue]);
        setCnicInputValue("");
      }
    } else if (
      e.key === "Backspace" &&
      cnicInputValue === "" &&
      allowedCnics.length > 0
    ) {
      // Delete the last tag if input is empty and user presses backspace
      const newCnics = [...allowedCnics];
      newCnics.pop();
      setAllowedCnics(newCnics);
    }
  };

  const removeCnicTag = (tagToRemove: string) => {
    setAllowedCnics(allowedCnics.filter((cnic) => cnic !== tagToRemove));
  };

  const handleCnicCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Split by newline, comma, semicolon, or tab
      const rawItems = text.split(/[\n\r,;\t]+/);
      const validCnics: string[] = [];
      let invalidCount = 0;

      rawItems.forEach((item) => {
        const clean = item.trim();
        if (!clean) return;

        // Check if it's already in the XXXXX-XXXXXXX-X format
        const formattedRegex = /^\d{5}-\d{7}-\d{1}$/;
        if (formattedRegex.test(clean)) {
          if (!validCnics.includes(clean)) {
            validCnics.push(clean);
          }
        } else {
          // Check if it is a 13-digit raw string
          const rawDigits = clean.replace(/\D/g, "");
          if (rawDigits.length === 13) {
            const formatted = `${rawDigits.substring(0, 5)}-${rawDigits.substring(5, 12)}-${rawDigits.substring(12, 13)}`;
            if (!validCnics.includes(formatted)) {
              validCnics.push(formatted);
            }
          } else {
            invalidCount++;
          }
        }
      });

      if (validCnics.length > 0) {
        // Merge with existing CNICs, avoiding duplicates
        const merged = [...allowedCnics];
        let addedCount = 0;
        validCnics.forEach((cnic) => {
          if (!merged.includes(cnic)) {
            merged.push(cnic);
            addedCount++;
          }
        });

        setAllowedCnics(merged);
        setCnicImportFeedback({
          type: "success",
          message: `Successfully imported ${addedCount} new CNIC(s).${invalidCount > 0 ? ` Skipped ${invalidCount} invalid values.` : ""}`,
        });
      } else {
        setCnicImportFeedback({
          type: "error",
          message: `No valid CNICs found in file. Ensure format is XXXXX-XXXXXXX-X or 13-digit numbers.`,
        });
      }

      // Reset file input so same file can be uploaded again if needed
      if (cnicCsvInputRef.current) {
        cnicCsvInputRef.current.value = "";
      }
    };

    reader.onerror = () => {
      setCnicImportFeedback({
        type: "error",
        message: "Failed to read the file.",
      });
    };

    reader.readAsText(file);
  };

  const handleSaveConstraints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    setQuizLoading(true);
    setError(null);

    const updatedFields: Partial<Quiz> = {
      totalAttemptsAllowed: Number(totalAttemptsAllowed),
      allowedCnics: allowedCnics,
      openAt: openAt ? new Date(openAt).toISOString() : "",
      closeAt: closeAt ? new Date(closeAt).toISOString() : "",
      postSubmissionText: postSubmissionText.trim(),
      perQuestionTimer: isPerQuestionTimer,
      timePerQuestionSeconds: isPerQuestionTimer ? Number(timePerQuestionSeconds) : null,
      timeLimit: !isPerQuestionTimer ? Number(quizTimeLimit) : 0,
    };

    try {
      await updateDoc(doc(db, "quizzes", selectedQuiz.id), updatedFields);
      if (hub) {
        await updateDoc(doc(db, "hubs", hub.id), {
          settings: {
            isPerQuestionTimer,
            timePerQuestionSeconds: isPerQuestionTimer
              ? Number(timePerQuestionSeconds)
              : 0,
            totalDurationMinutes: !isPerQuestionTimer
              ? Number(quizTimeLimit)
              : 0,
          },
        });
      }

      const refreshedQuiz = {
        ...selectedQuiz,
        ...updatedFields,
      };

      setQuizzes((prev) =>
        prev.map((q) => (q.id === selectedQuiz.id ? refreshedQuiz : q)),
      );
      setSelectedQuiz(refreshedQuiz);
      alert("SaaS scheduling rules and quiz constraints applied successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update scheduling rules");
    } finally {
      setQuizLoading(false);
    }
  };

  const toggleQuizStatus = async (
    quiz: Quiz,
    field: "isActive" | "isLiveCompetition",
  ) => {
    const path = `quizzes/${quiz.id}`;
    const updated = {
      ...quiz,
      [field]: !quiz[field],
    };
    try {
      await setDoc(doc(db, "quizzes", quiz.id), updated);
      setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? updated : q)));
      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(updated);
      }
      setLiveQuizzes(
        quizzes
          .map((q) => (q.id === quiz.id ? updated : q))
          .filter((q) => q.isLiveCompetition),
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (
      !window.confirm(
        "Delete this Quiz instance? This will permanently remove its entire questions pool.",
      )
    )
      return;
    const path = `quizzes/${quizId}`;
    try {
      await deleteDoc(doc(db, "quizzes", quizId));
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      if (selectedQuiz?.id === quizId) {
        setSelectedQuiz(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleQImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingQImage(true);
      setError(null);
      const url = await uploadToImgBB(file, imgbbApiKey);
      setQImageUrl(url);
    } catch (err: any) {
      setError(err.message || "Failed to upload question image");
    } finally {
      setIsUploadingQImage(false);
    }
  };

  // 4. Questions Manual Form Handlers
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz || !hub) return;
    setError(null);

    const qId = doc(collection(db, "hubs")).id; // generate random ID
    const options = [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()];

    const newQuestion: Question = {
      id: qId,
      quizId: selectedQuiz.id,
      text: qText.trim(),
      options,
      correctOption: Number(qCorrect),
      ...(qImageUrl && { imageUrl: qImageUrl }),
    };

    try {
      // Save directly into the hub's questions array
      await updateDoc(doc(db, "hubs", hub.id), {
        questions: arrayUnion(newQuestion),
      });
      setQuestions((prev) => [...prev, newQuestion]);
      setQText("");
      setQOptA("");
      setQOptB("");
      setQOptC("");
      setQOptD("");
      setQCorrect(0);
      setQImageUrl("");
    } catch (err: any) {
      setError(err.message || "Failed to append manual question");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!hub) return;
    const path = `hubs/${hub.id}`;
    try {
      const questionToRemove = questions.find((q) => q.id === questionId);
      if (questionToRemove) {
        await updateDoc(doc(db, "hubs", hub.id), {
          questions: arrayRemove(questionToRemove),
        });
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // 5. CSV Client-Side Parser Engine
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = "";

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
      } else if (char === "," && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = "";
      } else if ((char === "\r" || char === "\n") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        row.push(currentValue.trim());
        if (row.length > 0 && row.some((val) => val !== "")) {
          lines.push(row);
        }
        row = [];
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    if (currentValue || row.length > 0) {
      row.push(currentValue.trim());
      if (row.some((val) => val !== "")) {
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
          setCsvError("Failed to read file contents");
          return;
        }

        try {
          const rawRows = parseCSV(text);
          if (rawRows.length === 0) {
            setCsvError("No valid rows found in CSV");
            return;
          }

          // Header detection check
          const isHeader = (row: string[]) => {
            return row.some(
              (cell) =>
                cell.toLowerCase().includes("question text") ||
                cell.toLowerCase().includes("option a") ||
                cell.toLowerCase().includes("correct option text"),
            );
          };

          if (rawRows.length > 0 && isHeader(rawRows[0])) {
            rawRows.shift(); // Remove headers
          }

          // Map to validation rows
          const parsed: CsvQuestionRow[] = rawRows.map((parts, idx) => {
            const questionText = parts[0] || "";
            const optA = parts[1] || "";
            const optB = parts[2] || "";
            const optC = parts[3] || "";
            const optD = parts[4] || "";
            const correctText = parts[5] || "";

            const options = [optA, optB, optC, optD];

            // Validate: Correct Option Text must match option items case-insensitively
            const foundIdx = options.findIndex(
              (opt) =>
                opt.trim().toLowerCase() === correctText.trim().toLowerCase() &&
                opt.trim() !== "",
            );

            const isValid = foundIdx !== -1;

            return {
              id: "q_csv_" + crypto.randomUUID() + "_" + idx,
              text: questionText,
              options,
              correctOptionText: correctText,
              correctOptionIndex: foundIdx,
              isValid,
              validationMessage: isValid
                ? undefined
                : `Correct Option Text "${correctText}" fails to match any choice.`,
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
      (opt) =>
        opt.trim().toLowerCase() ===
          row.correctOptionText.trim().toLowerCase() && opt.trim() !== "",
    );
    const indexIsValid =
      row.correctOptionIndex >= 0 && row.correctOptionIndex <= 3;
    const finalValid = foundIdx !== -1 || indexIsValid;
    const finalIndex = foundIdx !== -1 ? foundIdx : row.correctOptionIndex;
    const finalText =
      foundIdx !== -1
        ? row.correctOptionText
        : row.options[row.correctOptionIndex] || "";

    return {
      ...row,
      correctOptionIndex: finalIndex,
      correctOptionText: finalText,
      isValid: finalValid,
      validationMessage: finalValid
        ? undefined
        : `Correct Option Text fails to match Option A, B, C, or D.`,
    };
  };

  // Execute Batch Transactional Commit to Firestore
  const handleCommitCsvQuestions = async () => {
    if (!selectedQuiz || !hub) return;

    const invalidRowsCount = parsedCsvQuestions.filter(
      (q) => !q.isValid,
    ).length;
    if (invalidRowsCount > 0) {
      alert(
        `Cannot commit. Please correct the ${invalidRowsCount} mismatched rows first.`,
      );
      return;
    }

    setQuizLoading(true);
    try {
      const newQuestions: Question[] = parsedCsvQuestions.map((row) => ({
        id: row.id,
        quizId: selectedQuiz.id,
        text: row.text,
        options: row.options,
        correctOption: row.correctOptionIndex,
      }));

      await updateDoc(doc(db, "hubs", hub.id), {
        questions: arrayUnion(...newQuestions),
      });

      setQuestions((prev) => [...prev, ...newQuestions]);
      setCsvSuccessCount(newQuestions.length);
      setParsedCsvQuestions([]);
      setCsvFile(null);
      setShowCsvOverlay(false);
      alert(
        `SaaS Bulk Loader: successfully committed ${newQuestions.length} questions!`,
      );
    } catch (err: any) {
      setError(err.message || "Firestore update failed.");
    } finally {
      setQuizLoading(false);
    }
  };

  // 6. Proctor Incident Parser Utility
  const parseProctorFlag = (flag: string): string => {
    const timeRegex = /(?:at\s+)?(\d{1,2}:\d{2}:\d{2}(?:\s*[APM]{2})?)/i;
    const match = flag.match(timeRegex);
    const timestamp = match ? ` [${match[1]}]` : "";

    const lowerFlag = flag.toLowerCase();
    if (
      lowerFlag.includes("tab switched") ||
      lowerFlag.includes("visibility hidden")
    ) {
      return `Tab Focus Lost${timestamp}`;
    }
    if (lowerFlag.includes("exited fullscreen")) {
      return `Exited Fullscreen Mode${timestamp}`;
    }
    if (
      lowerFlag.includes("window focus lost") ||
      lowerFlag.includes("window blur") ||
      lowerFlag.includes("focus lost")
    ) {
      return `Window Focus Lost${timestamp}`;
    }
    if (lowerFlag.includes("copy")) {
      return `Attempted Copy${timestamp}`;
    }
    if (lowerFlag.includes("paste")) {
      return `Attempted Paste${timestamp}`;
    }
    if (
      lowerFlag.includes("right click") ||
      lowerFlag.includes("contextmenu") ||
      lowerFlag.includes("context menu")
    ) {
      return `Attempted Right Click${timestamp}`;
    }
    if (lowerFlag.includes("devtools") || lowerFlag.includes("inspect")) {
      return `Attempted DevTools Access${timestamp}`;
    }
    return flag;
  };

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* SaaS Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-text flex items-center gap-3">
              <Layout className="h-8 w-8 text-brand-primary" />
              ArenaHub SaaS Console
            </h1>
            <p className="text-sm text-brand-muted mt-1">
              Enterprise assessment system with scheduling constraints, instant
              CSV parser, and live proctored war room streams.
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
                <span className="text-xs block text-brand-muted font-bold uppercase tracking-wider">
                  Tenant Portal
                </span>
                <span className="text-sm font-extrabold text-brand-text">
                  {hub.hubName}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Main Tab Switcher */}
        <div className="flex border-b border-brand-border mb-8 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab("hub")}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "hub"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
            id="tab-btn-hub"
          >
            <Settings className="h-4 w-4" />
            Hub Branding Settings
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "quizzes"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
            id="tab-btn-quizzes"
          >
            <BookOpen className="h-4 w-4" />
            Quiz & Question Builder
          </button>
          <button
            onClick={() => setActiveTab("warroom")}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "warroom"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
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
          {activeTab === "hub" && (
            <motion.div
              key="hub-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Branding Inputs */}
              <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                <h2 className="text-xl font-bold text-brand-text mb-4">
                  Branding & Tenancy
                </h2>

                <form onSubmit={handleSaveHub} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1">
                      Organization / Hub Name
                    </label>
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
                      <label className="block text-sm font-semibold text-brand-text mb-1">
                        Primary Brand Accent
                      </label>
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
                      <label className="block text-sm font-semibold text-brand-text mb-1">
                        Secondary Brand Accent
                      </label>
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
                    <label className="block text-sm font-semibold text-brand-text mb-1">
                      ImgBB API Key (Optional)
                    </label>
                    <p className="text-xs text-brand-muted mb-2">
                      Used to store uploaded logos permanently. If empty, falls
                      back to the default API key or local base64 previews.
                    </p>
                    <input
                      type="password"
                      value={imgbbApiKey}
                      onChange={(e) => setImgbbApiKey(e.target.value)}
                      placeholder="ImgBB API Client Key"
                      className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-text placeholder-brand-muted focus:ring-2 focus:ring-brand-primary/30 outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-brand-text mb-1">
                      Upload Portal Logo
                    </label>
                    <div className="border-2 border-dashed border-brand-border rounded-xl p-6 text-center hover:border-brand-primary/30 transition-all">
                      <Upload className="h-8 w-8 text-brand-muted mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        id="logo-upload-file"
                      />
                      <label
                        htmlFor="logo-upload-file"
                        className="text-sm font-semibold text-brand-primary hover:underline cursor-pointer block"
                      >
                        {logoFile
                          ? `Selected file: ${logoFile.name}`
                          : "Click here to choose a logo file"}
                      </label>
                      <span className="text-xs text-brand-muted mt-1 block">
                        PNG, JPG, WebP images accepted
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={hubLoading}
                      className="bg-brand-primary text-white font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-opacity-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                      id="hub-save-btn"
                    >
                      {hubLoading
                        ? "Saving Portal settings..."
                        : "Save Branding Configuration"}
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
                  <h2 className="text-xl font-bold text-brand-text mb-1">
                    Live Portal Preview
                  </h2>
                  <p className="text-xs text-brand-muted mb-6">
                    Visual branding rendered dynamically on users' login gates.
                  </p>

                  <div className="border border-brand-border rounded-xl overflow-hidden bg-brand-bg shadow-sm">
                    <div
                      className="p-3 bg-white flex items-center justify-between border-b border-brand-border"
                      style={{ borderTop: `4px solid ${primaryColor}` }}
                    >
                      <div className="flex items-center gap-2">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo Preview"
                            className="w-6 h-6 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded bg-slate-200"></div>
                        )}
                        <span className="font-bold text-2xs text-slate-800 truncate max-w-[150px]">
                          {hubName || "Your Portal Name"}
                        </span>
                      </div>
                      <div className="w-10 h-3 bg-slate-100 rounded"></div>
                    </div>

                    <div className="p-6 text-center">
                      <div
                        className="w-12 h-12 rounded-full bg-slate-50 border mx-auto mb-2 flex items-center justify-center"
                        style={{ borderColor: primaryColor }}
                      >
                        <BookOpen
                          className="h-5 w-5"
                          style={{ color: primaryColor }}
                        />
                      </div>
                      <h3 className="font-extrabold text-xs text-slate-800 mb-0.5">
                        Quiz Entry Room
                      </h3>
                      <p className="text-[10px] text-slate-400 mb-3">
                        Input your assessment code to authenticate
                      </p>

                      <div className="space-y-1 max-w-[180px] mx-auto">
                        <div
                          className="h-6 rounded text-[10px] font-bold text-white flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Verify & Begin Exam
                        </div>
                        <div
                          className="h-6 rounded text-[10px] border font-bold flex items-center justify-center"
                          style={{
                            borderColor: secondaryColor,
                            color: secondaryColor,
                          }}
                        >
                          Disconnect Hub
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-brand-border bg-slate-50/50 p-4 rounded-lg">
                  <span className="text-xs block text-brand-muted font-bold mb-1">
                    Enterprise Hub ID Code:
                  </span>
                  <code className="text-xs font-mono block bg-brand-bg border p-2.5 rounded text-brand-primary select-all font-bold tracking-wider text-center">
                    {user?.uid}
                  </code>
                  <span className="text-[10px] text-brand-muted mt-2 block leading-relaxed">
                    Provide this precise SaaS key to participants so they can
                    unlock your tenant portal, bypass global routing, and
                    receive your color presets.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: QUIZZES AND QUESTIONS BUILDER */}
          {activeTab === "quizzes" && (
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
                  <h2 className="text-lg font-bold text-brand-text mb-4">
                    Create New Quiz
                  </h2>
                  <form onSubmit={handleCreateQuiz} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">
                        Quiz Title
                      </label>
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
                        <label className="block text-xs font-bold text-brand-text mb-1">
                          Limit (Mins)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="300"
                          value={quizTimeLimit}
                          onChange={(e) =>
                            setQuizTimeLimit(Number(e.target.value))
                          }
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs"
                          id="quiz-time-input"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-brand-text mb-1">
                          Target Score %
                        </label>
                        <input
                          type="number"
                          required
                          min="10"
                          max="100"
                          value={quizPassPercentage}
                          onChange={(e) =>
                            setQuizPassPercentage(Number(e.target.value))
                          }
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs"
                          id="quiz-pass-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-brand-text mb-1">
                        Post-Submission Message (Optional)
                      </label>
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
                  <h2 className="text-lg font-bold text-brand-text mb-4">
                    Quiz Inventories
                  </h2>
                  {quizzes.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-brand-border rounded-xl bg-brand-bg/20">
                      <p className="text-xs text-brand-muted">
                        No quizzes constructed.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {quizzes.map((quiz) => (
                        <div
                          key={quiz.id}
                          onClick={() => setSelectedQuiz(quiz)}
                          className={`border rounded-xl p-3.5 cursor-pointer transition-all relative ${
                            selectedQuiz?.id === quiz.id
                              ? "border-brand-primary bg-brand-primary/5 shadow-xs"
                              : "border-brand-border hover:bg-brand-bg"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-extrabold text-xs text-brand-text block truncate max-w-[150px]">
                              {quiz.title}
                            </span>
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
                                toggleQuizStatus(quiz, "isActive");
                              }}
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer ${
                                quiz.isActive
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : "bg-slate-100 border-slate-200 text-slate-500"
                              }`}
                            >
                              {quiz.isActive ? "Active" : "Draft"}
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleQuizStatus(quiz, "isLiveCompetition");
                              }}
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border cursor-pointer ${
                                quiz.isLiveCompetition
                                  ? "bg-red-50 border-red-200 text-red-700 animate-pulse"
                                  : "bg-slate-100 border-slate-200 text-slate-500"
                              }`}
                            >
                              {quiz.isLiveCompetition
                                ? "Live Comp"
                                : "Standard"}
                            </button>
                          </div>

                          <div className="mt-2.5 bg-brand-bg px-2 py-1 rounded text-[9px] font-mono text-brand-muted flex justify-between items-center">
                            <span className="truncate">Code: <span className="font-bold text-brand-text text-[10px]">{quiz.joinCode || 'Legacy Quiz (No Code)'}</span></span>
                            <span className="shrink-0 font-bold text-brand-primary cursor-pointer hover:underline">
                              Select
                            </span>
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
                        <span className="text-[10px] text-brand-muted font-bold uppercase tracking-widest">
                          Active Configuration
                        </span>
                        <h3 className="text-xl font-black text-brand-text">
                          {selectedQuiz.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-brand-muted mt-1.5">
                          <span>
                            <strong>{questions.length}</strong> questions in
                            pool
                          </span>
                          <span>•</span>
                          <span>
                            SaaS Key:{" "}
                            <code className="font-mono bg-brand-bg px-1.5 py-0.5 rounded text-brand-primary font-bold">
                              {selectedQuiz.id}
                            </code>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          selectedQuiz.isLiveCompetition
                            ? "bg-red-100 text-red-800 animate-pulse border border-red-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {selectedQuiz.isLiveCompetition
                          ? "Live Feed Active"
                          : "Offline Sandbox"}
                      </span>
                    </div>

                    {/* FEATURE 1: QUIZ CONSTRAINTS & SCHEDULING RULES */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                        <Calendar className="h-5 w-5 text-brand-primary" />
                        <div>
                          <h3 className="text-sm font-extrabold text-brand-text">
                            Quiz Scheduling & Security Constraints
                          </h3>
                          <p className="text-[10px] text-brand-muted">
                            Set scheduling windows and define strict participant
                            white-lists.
                          </p>
                        </div>
                      </div>

                      <form
                        onSubmit={handleSaveConstraints}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-brand-text mb-1">
                              Total Attempts Allowed
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              required
                              value={totalAttemptsAllowed}
                              onChange={(e) =>
                                setTotalAttemptsAllowed(Number(e.target.value))
                              }
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                            />
                            <p className="text-[9px] text-brand-muted mt-1">
                              Limits participant start attempts using their
                              unique ID.
                            </p>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-xs font-bold text-brand-text">
                                Allowed CNICs (White-list)
                              </label>
                              <div className="flex items-center gap-2">
                                {allowedCnics.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAllowedCnics([]);
                                      setCnicImportFeedback(null);
                                    }}
                                    className="text-[10px] text-red-500 hover:text-red-600 font-bold transition-colors underline"
                                  >
                                    Clear All
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    cnicCsvInputRef.current?.click()
                                  }
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded text-[10px] font-bold transition-all"
                                >
                                  <Upload className="h-2.5 w-2.5" />
                                  Bulk Upload CSV
                                </button>
                                <input
                                  type="file"
                                  ref={cnicCsvInputRef}
                                  onChange={handleCnicCsvUpload}
                                  accept=".csv,.txt"
                                  className="hidden"
                                />
                              </div>
                            </div>

                            {/* Tag Container */}
                            <div className="flex flex-wrap items-center gap-2 w-full bg-brand-bg border border-brand-border rounded-lg p-2 focus-within:ring-1 focus-within:ring-brand-primary/30 transition-all min-h-[42px]">
                              {/* Map existing CNIC tags */}
                              {allowedCnics.map((cnic, index) => (
                                <span
                                  key={index}
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded text-[10px] font-mono tracking-wide"
                                >
                                  {cnic}
                                  <button
                                    type="button"
                                    onClick={() => removeCnicTag(cnic)}
                                    className="hover:bg-brand-primary/20 p-0.5 rounded-full transition-colors"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              ))}

                              {/* The actual input field */}
                              <input
                                type="text"
                                value={cnicInputValue}
                                onChange={handleCnicInputChange}
                                onKeyDown={handleCnicKeyDown}
                                placeholder={
                                  allowedCnics.length === 0
                                    ? "E.g., 35201-1234567-9 (Press Enter)"
                                    : "Type CNIC & Press Enter..."
                                }
                                className="flex-1 min-w-[150px] bg-transparent outline-none text-brand-text placeholder-brand-muted text-xs font-mono tracking-wide"
                              />
                            </div>

                            {cnicImportFeedback && (
                              <div
                                className={`mt-1 text-[9px] font-semibold px-2 py-0.5 rounded border ${
                                  cnicImportFeedback.type === "success"
                                    ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                                    : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                                }`}
                              >
                                {cnicImportFeedback.message}
                              </div>
                            )}

                            <p className="text-[9px] text-brand-muted mt-1 font-medium">
                              Press{" "}
                              <kbd className="bg-brand-border/50 px-1 py-0.5 rounded text-brand-text font-bold">
                                Enter
                              </kbd>{" "}
                              or type a Comma (,) to add a CNIC manually, or upload a CSV.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer p-3 bg-brand-bg border border-brand-border rounded-lg mb-4 hover:bg-brand-primary/5 transition-colors">
                              <input
                                type="checkbox"
                                checked={isPerQuestionTimer}
                                onChange={(e) =>
                                  setIsPerQuestionTimer(e.target.checked)
                                }
                                className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                              />
                              <span className="text-xs font-bold text-brand-text">
                                Enforce Per-Question Timer
                              </span>
                            </label>
                            {isPerQuestionTimer ? (
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-brand-text mb-1">
                                  Seconds per Question
                                </label>
                                <input
                                  type="number"
                                  min="5"
                                  value={timePerQuestionSeconds}
                                  onChange={(e) =>
                                    setTimePerQuestionSeconds(
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                                />
                              </div>
                            ) : (
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-brand-text mb-1">
                                  Total Quiz Duration (Minutes)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={quizTimeLimit}
                                  onChange={(e) =>
                                    setQuizTimeLimit(Number(e.target.value))
                                  }
                                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-brand-text mb-1">
                              Quiz Open Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={openAt}
                              onChange={(e) => setOpenAt(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                            />
                            <p className="text-[9px] text-brand-muted mt-1">
                              Participants cannot begin before this instant.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-brand-text mb-1">
                              Quiz Close Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={closeAt}
                              onChange={(e) => setCloseAt(e.target.value)}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                            />
                            <p className="text-[9px] text-brand-muted mt-1">
                              Access shuts down automatically after this
                              instant.
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-brand-text mb-1">
                            Post-Submission Message (Optional)
                          </label>
                          <textarea
                            value={postSubmissionText}
                            onChange={(e) =>
                              setPostSubmissionText(e.target.value)
                            }
                            placeholder="E.g., Your quiz has been submitted successfully. Custom results will be announced via email."
                            rows={2}
                            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text placeholder-brand-muted focus:ring-1 focus:ring-brand-primary/30 outline-none text-xs"
                            id="edit-quiz-post-submission-text-input"
                          />
                          <p className="text-[9px] text-brand-muted mt-1">
                            This message will be shown to participants on the
                            blind result screen after submission.
                          </p>
                        </div>

                        <button
                          type="submit"
                          className="bg-brand-primary hover:bg-opacity-95 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <CheckCircle className="h-4 w-4" /> Save Scheduling &
                          Constraints
                        </button>
                      </form>
                    </div>

                    {/* Manual Question Form & CSV File Input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Manual Question box */}
                      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                        <h4 className="text-xs font-black uppercase tracking-wider text-brand-text mb-3">
                          Add Question Manually
                        </h4>
                        <form
                          onSubmit={handleAddQuestion}
                          className="space-y-3"
                        >
                          <div>
                            <label className="block text-[10px] font-bold text-brand-text mb-1">
                              Question Statement
                            </label>
                            <textarea
                              required
                              value={qText}
                              onChange={(e) => setQText(e.target.value)}
                              placeholder="Ask a clear concept..."
                              className="w-full bg-brand-bg border border-brand-border rounded-lg p-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none h-14 resize-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-brand-text">
                              Option Text choices
                            </label>
                            <input
                              type="text"
                              required
                              value={qOptA}
                              onChange={(e) => setQOptA(e.target.value)}
                              placeholder="Option A (Index 0)"
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                            />
                            <input
                              type="text"
                              required
                              value={qOptB}
                              onChange={(e) => setQOptB(e.target.value)}
                              placeholder="Option B (Index 1)"
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                            />
                            <input
                              type="text"
                              required
                              value={qOptC}
                              onChange={(e) => setQOptC(e.target.value)}
                              placeholder="Option C (Index 2)"
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                            />
                            <input
                              type="text"
                              required
                              value={qOptD}
                              onChange={(e) => setQOptD(e.target.value)}
                              placeholder="Option D (Index 3)"
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1 text-xs text-brand-text outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-brand-text mb-1">
                              Correct Choice
                            </label>
                            <select
                              value={qCorrect}
                              onChange={(e) =>
                                setQCorrect(Number(e.target.value))
                              }
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-xs text-brand-text"
                            >
                              <option value="0">Option A (Index 0)</option>
                              <option value="1">Option B (Index 1)</option>
                              <option value="2">Option C (Index 2)</option>
                              <option value="3">Option D (Index 3)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-brand-text mb-1">
                              Question Image (Optional)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleQImageUpload}
                              disabled={isUploadingQImage}
                              className="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-xs text-brand-text file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-opacity-90"
                            />
                            {isUploadingQImage && (
                              <span className="text-[10px] text-brand-muted mt-1 block">
                                Uploading...
                              </span>
                            )}
                            {qImageUrl && (
                              <div className="mt-2 relative inline-block">
                                <img
                                  src={qImageUrl}
                                  alt="Question preview"
                                  className="h-16 w-16 object-cover rounded-md border border-brand-border"
                                />
                                <button
                                  type="button"
                                  onClick={() => setQImageUrl("")}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-brand-primary text-white font-bold text-xs py-2 rounded-lg hover:bg-opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" /> Save to Question
                            Pool
                          </button>
                        </form>
                      </div>

                      {/* FEATURE 2: BULK QUIZ CSV FILE SELECT */}
                      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-brand-text mb-2">
                            CSV Bulk Question Loader
                          </h4>
                          <p className="text-[10px] text-brand-muted leading-relaxed mb-4">
                            Upload massive datasets instantly. File columns must
                            map exactly as: <br />
                            <code className="font-mono text-brand-primary font-bold text-3xs">
                              Question Text, Option A, Option B, Option C,
                              Option D, Correct Option Text
                            </code>
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
                            <label
                              htmlFor="csv-bulk-select-input"
                              className="text-xs font-bold text-brand-primary hover:underline cursor-pointer block"
                            >
                              {csvFile
                                ? `Selected: ${csvFile.name}`
                                : "Click here to load CSV template"}
                            </label>
                            <span className="text-[9px] text-brand-muted mt-1 block">
                              Launches Interactive Row Checker
                            </span>
                          </div>

                          {csvError && (
                            <div className="p-2.5 mt-3 bg-red-50 text-red-700 text-3xs rounded-lg border border-red-200">
                              {csvError}
                            </div>
                          )}

                          {csvSuccessCount !== null && (
                            <div className="p-2.5 mt-3 bg-green-50 text-green-700 text-3xs rounded-lg border border-green-200">
                              Bulk parsed & uploaded {csvSuccessCount} items
                              safely!
                            </div>
                          )}
                        </div>

                        <div className="mt-4 bg-brand-bg p-3 rounded-lg border border-brand-border/40 text-3xs text-brand-muted">
                          <strong className="block text-brand-text mb-1 font-bold">
                            Standard CSV Row Pattern:
                          </strong>
                          <code className="font-mono block leading-tight break-all">
                            "What is React?", "Framework", "Library", "Service",
                            "Engine", "Library"
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Selected Quiz Questions List preview */}
                    <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xs">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-extrabold text-brand-text">
                          Questions Pool Preview ({questions.length})
                        </h4>
                        <button
                          onClick={handleDownloadQuestionPaper}
                          disabled={
                            isDownloadingPaper || questions.length === 0
                          }
                          className="px-3 py-1.5 bg-brand-primary disabled:opacity-50 text-white text-3xs font-extrabold rounded-lg flex items-center gap-1.5 hover:bg-opacity-90 transition-all cursor-pointer shadow-sm hover:shadow"
                          id="print-question-paper-btn"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>
                            {isDownloadingPaper
                              ? "Generating PDF..."
                              : "Print Question Paper"}
                          </span>
                        </button>
                      </div>
                      {questions.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-brand-border rounded-xl bg-brand-bg/10">
                          <p className="text-xs text-brand-muted">
                            No questions saved. Input manually or drag a CSV
                            above.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                          {questions.map((q, qIdx) => (
                            <div
                              key={q.id}
                              className="border border-brand-border rounded-xl p-3.5 bg-brand-bg/30 relative"
                            >
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="absolute top-3.5 right-3.5 text-red-500 hover:text-red-700 p-0.5"
                                title="Delete Question"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>

                              <span className="text-[10px] font-black text-brand-primary block mb-1">
                                Question {qIdx + 1}
                              </span>
                              <p className="text-xs font-extrabold text-brand-text mb-2.5 pr-8">
                                {q.text}
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.options.map((opt, oIdx) => {
                                  const isCorrect = q.correctOption === oIdx;
                                  return (
                                    <div
                                      key={oIdx}
                                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                                        isCorrect
                                          ? "bg-green-50 border-green-300 text-green-800 font-bold"
                                          : "bg-white border-brand-border text-brand-text"
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isCorrect && (
                                        <Check className="h-3 w-3 text-green-600" />
                                      )}
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
                    <h3 className="text-base font-bold text-brand-text mb-1">
                      No Quiz Instance Selected
                    </h3>
                    <p className="text-xs text-brand-muted">
                      Initialize a new quiz or choose an active card from the
                      inventory list to manage properties and questions.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: LIVE WAR ROOM MONITOR (TELEMETRY MONITOR) */}
          {activeTab === "warroom" && (
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
                    Secure real-time dashboard streaming participant telemetry
                    and auto-proctoring incident logs.
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
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
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
                        <label className="block text-xs font-bold text-brand-text mb-1">
                          Authorized Signatory Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., M Aqeel Afzal"
                          value={reportSignatoryName}
                          onChange={(e) =>
                            setReportSignatoryName(e.target.value)
                          }
                          className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-xs font-semibold text-brand-text focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-brand-text mb-1">
                          Designation / Department
                        </label>
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
                        <span>📊</span>{" "}
                        {isGeneratingReport
                          ? "Generating..."
                          : "Download Ranked Scoreboard (PDF)"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-xs">
                    <div className="px-6 py-4 bg-slate-50 border-b border-brand-border flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-extrabold text-brand-text uppercase tracking-wider">
                        Live Synchronized Sessions ({liveAttempts.length})
                      </span>
                      <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>{" "}
                        Real-time Active
                      </span>
                    </div>

                    {liveAttempts.length === 0 ? (
                      <div className="text-center py-16 px-4">
                        <Users className="h-10 w-10 text-brand-muted mx-auto mb-2" />
                        <h3 className="text-base font-bold text-brand-text mb-1">
                          Awaiting Participants
                        </h3>
                        <p className="text-xs text-brand-muted max-w-sm mx-auto mt-1">
                          Candidates entering this proctored quiz via the
                          ArenaGate will stream onto this dashboard instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-brand-bg border-b border-brand-border text-brand-muted font-bold text-[10px] uppercase tracking-wider">
                              <th className="px-6 py-3.5">
                                Participant Details
                              </th>
                              <th className="px-6 py-3.5">CNIC Identity</th>
                              <th className="px-6 py-3.5">Telemetry Status</th>
                              <th className="px-6 py-3.5">Current Score</th>
                              <th className="px-6 py-3.5">
                                Total Time Consumed
                              </th>
                              <th className="px-6 py-3.5">
                                Proctor Incident Activity Log
                              </th>
                              <th className="px-6 py-3.5">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-border">
                            {liveAttempts.map((attempt) => {
                              const seconds = attempt.timeSpentSeconds;
                              const min = Math.floor(seconds / 60);
                              const sec = seconds % 60;
                              const timeStr = `${min}:${sec < 10 ? "0" : ""}${sec}`;

                              return (
                                <tr
                                  key={attempt.id}
                                  className="hover:bg-brand-bg/20 transition-colors"
                                >
                                  <td className="px-6 py-4">
                                    <div>
                                      <span className="font-extrabold text-brand-text block text-sm">
                                        {attempt.userName}
                                      </span>
                                      <span className="text-[10px] text-brand-muted block mt-0.5">
                                        {attempt.userEmail}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-6 py-4 font-mono font-semibold text-brand-text text-xs">
                                    {attempt.userCnic}
                                  </td>

                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5 items-start">
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                          attempt.status === "Submitted"
                                            ? "bg-green-50 border-green-200 text-green-700"
                                            : attempt.status === "Locked Out"
                                              ? "bg-red-50 border-red-200 text-red-700"
                                              : "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
                                        }`}
                                      >
                                        {attempt.status}
                                      </span>
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                          attempt.cameraStatus === "Active"
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                            : attempt.cameraStatus ===
                                                "No Hardware"
                                              ? "bg-gray-100 border-gray-200 text-gray-600"
                                              : attempt.cameraStatus ===
                                                  "Permission Denied"
                                                ? "bg-rose-50 border-rose-200 text-rose-700"
                                                : "bg-slate-50 border-slate-200 text-slate-600"
                                        }`}
                                      >
                                        📷{" "}
                                        {attempt.cameraStatus ||
                                          "Requesting..."}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-6 py-4 font-bold text-brand-text text-sm">
                                    {attempt.status === "In Progress" ? (
                                      <span className="text-brand-muted italic text-xs">
                                        Answering...
                                      </span>
                                    ) : (
                                      <div>
                                        <span>{attempt.score} Points</span>
                                        <span
                                          className={`block text-[9px] font-black mt-0.5 uppercase ${attempt.passed ? "text-green-600" : "text-red-500"}`}
                                        >
                                          {attempt.passed ? "Passed" : "Failed"}
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
                                        <Check className="h-3.5 w-3.5" /> Secure
                                        Environment
                                      </span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {attempt.cheatFlags.map(
                                          (flag, fIdx) => (
                                            <span
                                              key={fIdx}
                                              className="text-[9px] bg-red-100 text-red-800 font-black px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1"
                                            >
                                              <ShieldAlert className="h-2.5 w-2.5 text-red-600 shrink-0" />
                                              {parseProctorFlag(flag)}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      {attempt.status === "In Progress" ? (
                                        <button
                                          onClick={async () => {
                                            if (
                                              confirm(
                                                "Are you sure you want to terminate this student's exam?",
                                              )
                                            ) {
                                              try {
                                                await updateDoc(
                                                  doc(
                                                    db,
                                                    "attempts",
                                                    attempt.id,
                                                  ),
                                                  {
                                                    forceLocked: true,
                                                    cheatFlags: arrayUnion(
                                                      "Manually Terminated by Admin",
                                                    ),
                                                  },
                                                );
                                              } catch (err: any) {
                                                console.error(
                                                  "Failed to terminate session:",
                                                  err,
                                                );
                                                alert(
                                                  "Error force-terminating session: " +
                                                    err.message,
                                                );
                                              }
                                            }
                                          }}
                                          className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 rounded text-[11px] shadow-xs cursor-pointer transition-colors"
                                        >
                                          Force Terminate
                                        </button>
                                      ) : (
                                        <span className="text-brand-muted font-bold text-[11px]">
                                          Terminated
                                        </span>
                                      )}

                                      <button
                                        onClick={() => handleViewAudit(attempt)}
                                        disabled={isFetchingAudit}
                                        className="px-3 py-1.5 bg-brand-primary disabled:opacity-50 text-white text-[11px] font-extrabold rounded-md flex items-center gap-1 hover:bg-opacity-90 transition-all cursor-pointer shadow-sm hover:shadow"
                                        title="Inspect Answers"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        <span>
                                          {isFetchingAudit &&
                                          auditAttempt?.id === attempt.id
                                            ? "Loading..."
                                            : "Inspect Answers"}
                                        </span>
                                      </button>
                                    </div>
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
                  <h3 className="text-base font-bold text-brand-text mb-1">
                    Awaiting War Room selection
                  </h3>
                  <p className="text-xs text-brand-muted max-w-sm mx-auto">
                    Activate "Live Comp" status on any quiz in the builder tab,
                    then select it from the dropdown corner above to start
                    receiving candidates' telemetry.
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
                      <span>
                        Parsed: <strong>{parsedCsvQuestions.length}</strong>{" "}
                        items
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-bold text-red-600">
                        Mismatches needing repair:{" "}
                        <strong>
                          {parsedCsvQuestions.filter((q) => !q.isValid).length}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowCsvOverlay(false);
                      setCsvFile(null);
                    }}
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
                      <span className="font-extrabold block">
                        Row validation logic in progress:
                      </span>
                      For each question, the 'Correct Option Text' column must
                      match exactly one of the four Option columns. Highlighted
                      rows indicate mismatches. You can adjust the text choices,
                      question text, or select the Correct Option dropdown
                      in-place below to resolve errors instantly before
                      executing the transaction commit!
                    </div>
                  </div>

                  <div className="border border-brand-border rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-brand-bg border-b border-brand-border text-brand-muted font-bold text-[10px] uppercase tracking-wider">
                          <th className="px-4 py-2 w-[50px] text-center">
                            Row
                          </th>
                          <th className="px-4 py-2 min-w-[200px]">
                            Question Text
                          </th>
                          <th className="px-4 py-2 min-w-[120px]">Option A</th>
                          <th className="px-4 py-2 min-w-[120px]">Option B</th>
                          <th className="px-4 py-2 min-w-[120px]">Option C</th>
                          <th className="px-4 py-2 min-w-[120px]">Option D</th>
                          <th className="px-4 py-2 min-w-[160px]">
                            Correct Option Check
                          </th>
                          <th className="px-4 py-2 w-[110px] text-center">
                            Status
                          </th>
                          <th className="px-4 py-2 w-[60px] text-center">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {parsedCsvQuestions.map((row, idx) => (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              row.isValid
                                ? "hover:bg-brand-bg/10"
                                : "bg-red-50/40 hover:bg-red-50/60 text-red-950"
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
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            text: newText,
                                          })
                                        : r,
                                    ),
                                  );
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
                                  const newOpts = [
                                    newOpt,
                                    row.options[1],
                                    row.options[2],
                                    row.options[3],
                                  ];
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            options: newOpts,
                                          })
                                        : r,
                                    ),
                                  );
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
                                  const newOpts = [
                                    row.options[0],
                                    newOpt,
                                    row.options[2],
                                    row.options[3],
                                  ];
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            options: newOpts,
                                          })
                                        : r,
                                    ),
                                  );
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
                                  const newOpts = [
                                    row.options[0],
                                    row.options[1],
                                    newOpt,
                                    row.options[3],
                                  ];
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            options: newOpts,
                                          })
                                        : r,
                                    ),
                                  );
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
                                  const newOpts = [
                                    row.options[0],
                                    row.options[1],
                                    row.options[2],
                                    newOpt,
                                  ];
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            options: newOpts,
                                          })
                                        : r,
                                    ),
                                  );
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
                                  const newText = row.options[newIdx] || "";
                                  setParsedCsvQuestions((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? validateSingleRow({
                                            ...r,
                                            correctOptionIndex: newIdx,
                                            correctOptionText: newText,
                                          })
                                        : r,
                                    ),
                                  );
                                }}
                                className="bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-xs text-brand-text w-full focus:ring-1 focus:ring-brand-primary/40 outline-none font-medium"
                              >
                                <option value="-1">-- Mismatch Error --</option>
                                <option value="0">
                                  A: {row.options[0] || "(empty)"}
                                </option>
                                <option value="1">
                                  B: {row.options[1] || "(empty)"}
                                </option>
                                <option value="2">
                                  C: {row.options[2] || "(empty)"}
                                </option>
                                <option value="3">
                                  D: {row.options[3] || "(empty)"}
                                </option>
                              </select>
                            </td>

                            {/* Validation Status column */}
                            <td className="px-4 py-3 text-center">
                              {row.isValid ? (
                                <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                                  <Check className="h-3.5 w-3.5 shrink-0" />{" "}
                                  Ready
                                </span>
                              ) : (
                                <span
                                  className="text-red-600 font-extrabold flex items-center justify-center gap-1 animate-pulse"
                                  title={row.validationMessage}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{" "}
                                  Mismatch
                                </span>
                              )}
                            </td>

                            {/* Action - Delete single row */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setParsedCsvQuestions((prev) =>
                                    prev.filter((r) => r.id !== row.id),
                                  );
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
                      onClick={() => {
                        setShowCsvOverlay(false);
                        setCsvFile(null);
                      }}
                      className="border border-brand-border bg-white text-brand-text text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-brand-bg transition-all"
                    >
                      Discard Changes
                    </button>
                    <button
                      onClick={() => {
                        const newRowId =
                          "q_csv_" + crypto.randomUUID() + "_manual";
                        const newRow: CsvQuestionRow = {
                          id: newRowId,
                          text: "New Question statement",
                          options: [
                            "Choice A",
                            "Choice B",
                            "Choice C",
                            "Choice D",
                          ],
                          correctOptionText: "Choice A",
                          correctOptionIndex: 0,
                          isValid: true,
                        };
                        setParsedCsvQuestions((prev) => [...prev, newRow]);
                      }}
                      className="border border-brand-border bg-slate-100 text-brand-text text-xs font-bold px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 transition-all flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add Question Row
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {parsedCsvQuestions.filter((q) => !q.isValid).length >
                      0 && (
                      <span className="text-xs text-red-600 font-bold flex items-center gap-1 animate-bounce">
                        <AlertCircle className="h-4 w-4" /> Correct highlighted
                        mismatch items first
                      </span>
                    )}

                    <button
                      onClick={handleCommitCsvQuestions}
                      disabled={
                        parsedCsvQuestions.filter((q) => !q.isValid).length >
                          0 || parsedCsvQuestions.length === 0
                      }
                      className="bg-brand-accent text-white text-xs font-extrabold px-6 py-2.5 rounded-lg disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm hover:bg-opacity-95"
                    >
                      <CheckCircle className="h-4 w-4" /> Commit Batch
                      Transaction
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Student Attempt Audit Modal */}
        <AnimatePresence>
          {auditAttempt && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-brand-card border border-brand-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              >
                <div
                  id="audit-print-container"
                  className="flex flex-col flex-1 overflow-y-auto bg-brand-card text-brand-text"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg/50">
                    <div>
                      <h3 className="text-lg font-black text-brand-text flex items-center gap-2">
                        <Eye className="h-5 w-5 text-brand-primary" />
                        Student Attempt Audit
                      </h3>
                      <div className="text-xs text-brand-muted mt-1 space-y-0.5">
                        <div>
                          Candidate:{" "}
                          <strong className="text-brand-text">
                            {auditAttempt.userName}
                          </strong>{" "}
                          ({auditAttempt.userEmail})
                          <span className="mx-2">|</span> CNIC:{" "}
                          <strong className="text-brand-text">
                            {auditAttempt.userCnic}
                          </strong>
                        </div>
                        <div>
                          Score:{" "}
                          <strong className="text-brand-primary">
                            {auditAttempt.score} Points
                          </strong>{" "}
                          ({auditAttempt.passed ? "PASSED" : "FAILED"})
                        </div>

                        {/* Forensic Metadata Section */}
                        <div className="mt-3 pt-3 border-t border-brand-border/30">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary block mb-1">
                            Forensic Metadata
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-brand-muted">
                            <div>
                              <strong>Device OS/Type:</strong>{" "}
                              <span className="text-brand-text">
                                {auditAttempt.deviceInfo || "N/A"}
                              </span>
                            </div>
                            <div>
                              <strong>Network IP:</strong>{" "}
                              <span className="text-brand-text">
                                {auditAttempt.ipAddress || "N/A"}
                              </span>
                            </div>
                            <div>
                              <strong>Session Started:</strong>{" "}
                              <span className="text-brand-text">
                                {formatForensicTime(auditAttempt.startedAt)}
                              </span>
                            </div>
                            <div>
                              <strong>Session Ended:</strong>{" "}
                              <span className="text-brand-text">
                                {formatForensicTime(auditAttempt.submittedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAuditAttempt(null)}
                      className="p-1.5 hover:bg-brand-bg rounded-lg text-brand-muted hover:text-brand-text transition-colors cursor-pointer print-hidden"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-4 flex-1">
                    {auditQuestions.length === 0 ? (
                      <div className="text-center py-12 text-brand-muted text-sm">
                        No questions found for this quiz.
                      </div>
                    ) : (
                      auditQuestions.map((q, index) => {
                        const studentAnsVal =
                          auditAttempt.studentAnswers?.[q.id || ""];
                        const correctAnsVal = auditSecureAnswers[q.id || ""];

                        // Get expected correct string
                        let correctText = "";
                        if (correctAnsVal !== undefined) {
                          if (
                            typeof correctAnsVal === "number" ||
                            !isNaN(Number(correctAnsVal))
                          ) {
                            correctText =
                              q.options[Number(correctAnsVal)] || "";
                          } else {
                            correctText = String(correctAnsVal);
                          }
                        } else {
                          correctText = q.options[q.correctOption] || "";
                        }

                        // Get student selected string
                        let studentText = "";
                        if (studentAnsVal !== undefined) {
                          if (
                            typeof studentAnsVal === "number" ||
                            !isNaN(Number(studentAnsVal))
                          ) {
                            studentText =
                              q.options[Number(studentAnsVal)] || "";
                          } else {
                            studentText = String(studentAnsVal);
                          }
                        }

                        // Determine if correct
                        const isCorrect =
                          studentAnsVal !== undefined &&
                          (studentText.trim().toLowerCase() ===
                            correctText.trim().toLowerCase() ||
                            String(studentAnsVal) === String(correctAnsVal));

                        return (
                          <div
                            key={q.id || index}
                            className={`p-4 rounded-xl border transition-all ${
                              isCorrect
                                ? "bg-emerald-500/5 border-emerald-500/30 text-brand-text"
                                : "bg-rose-500/5 border-rose-500/30 text-brand-text"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold whitespace-nowrap uppercase ${
                                  isCorrect
                                    ? "bg-emerald-500/20 text-emerald-600"
                                    : "bg-rose-500/20 text-rose-600"
                                }`}
                              >
                                Q{index + 1} -{" "}
                                {isCorrect ? "Correct" : "Incorrect"}
                              </span>
                              <p className="font-bold text-sm text-brand-text">
                                {q.text}
                              </p>
                            </div>

                            {/* Options list for review */}
                            <div className="mt-3 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, oIdx) => {
                                const isSelected =
                                  studentAnsVal !== undefined &&
                                  (String(studentAnsVal) === String(oIdx) ||
                                    String(studentAnsVal)
                                      .trim()
                                      .toLowerCase() ===
                                      opt.trim().toLowerCase());
                                const isThisCorrect =
                                  correctAnsVal !== undefined &&
                                  (String(correctAnsVal) === String(oIdx) ||
                                    String(correctAnsVal)
                                      .trim()
                                      .toLowerCase() ===
                                      opt.trim().toLowerCase());

                                return (
                                  <div
                                    key={oIdx}
                                    className={`text-xs p-2 rounded-lg border ${
                                      isSelected && isThisCorrect
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 font-bold"
                                        : isSelected
                                          ? "bg-rose-500/15 border-rose-500/40 text-rose-700 font-bold"
                                          : isThisCorrect
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 font-semibold"
                                            : "bg-brand-bg/40 border-brand-border text-brand-muted"
                                    }`}
                                  >
                                    <span className="font-black mr-1">
                                      {String.fromCharCode(65 + oIdx)})
                                    </span>
                                    {opt}
                                    {isSelected && (
                                      <span className="ml-1.5 text-[10px] font-extrabold">
                                        (Selected)
                                      </span>
                                    )}
                                    {isThisCorrect && (
                                      <span className="ml-1.5 text-[10px] font-extrabold">
                                        (Correct Answer)
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Summary of answers */}
                              <div className="mt-3 bg-brand-bg p-3 rounded-lg border border-brand-border ml-8">
                                <p className="text-sm">
                                  <span className="font-bold text-brand-text">
                                    Candidate's Selection:{" "}
                                  </span>
                                  <span
                                    className={`font-bold ${isCorrect ? "text-emerald-600" : "text-rose-600"}`}
                                  >
                                    {studentText || "No Answer Provided"}{" "}
                                    {isCorrect
                                      ? "(✔️ CORRECT)"
                                      : "(❌ INCORRECT)"}
                                  </span>
                                </p>
                                <p className="text-sm mt-1">
                                  <span className="font-bold text-brand-text">
                                    Official Answer Key:{" "}
                                  </span>
                                  <span className="font-bold text-brand-primary">
                                    {correctText}
                                  </span>
                                </p>
                              </div>{" "}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-brand-border flex justify-end gap-3 bg-brand-bg/30">
                  <button
                    onClick={handleDownloadAuditPDF}
                    disabled={isDownloadingAudit}
                    className="px-4 py-2 bg-brand-primary disabled:opacity-50 text-white font-bold text-xs rounded-xl hover:bg-opacity-90 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow"
                  >
                    <FileText className="h-4 w-4" />
                    <span>
                      {isDownloadingAudit
                        ? "Generating PDF..."
                        : "Download Forensic Audit (PDF)"}
                    </span>
                  </button>
                  <button
                    onClick={() => setAuditAttempt(null)}
                    className="px-4 py-2 bg-brand-bg border border-brand-border text-brand-text font-bold text-xs rounded-xl hover:bg-brand-border transition-colors cursor-pointer"
                  >
                    Close Audit View
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
