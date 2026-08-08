import re

with open('src/pages/OrganizerDashboard.tsx', 'r') as f:
    content = f.read()

# Replace jsPDF and html2canvas with react-dom/client and html2pdf.js
content = re.sub(
    r"import \{ jsPDF \} from 'jspdf';\nimport html2canvas from 'html2canvas';",
    "import { createRoot } from 'react-dom/client';\nimport html2pdf from 'html2pdf.js';\nimport { PrintableReport } from '../components/PrintableReport';\nimport { PrintableQuestionPaper } from '../components/PrintableQuestionPaper';\nimport { PrintableScoreboard } from '../components/PrintableScoreboard';",
    content
)

# Function replacement logic
# Replace handleDownloadRankedReport
def replace_ranked_report(content):
    pattern = r"const handleDownloadRankedReport = async \(\) => \{.*?finally \{\s*setIsGeneratingReport\(false\);\s*\}\s*\};"
    replacement = """const handleDownloadRankedReport = async () => {
    if (!activeLiveQuizId) return;
    setIsGeneratingReport(true);

    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableScoreboard
          quizTitle={liveQuizData?.title || 'Unknown Quiz'}
          hubName={hubData?.hubName || hub?.hubName || hubName || 'Event'}
          attempts={liveData}
          reportSignatoryName={reportSignatoryName}
          reportDesignation={reportDesignation}
          primaryThemeColor={hubData?.primaryColor || primaryColor || '#ea580c'}
        />
      );

      // Give React time to render
      await new Promise(resolve => setTimeout(resolve, 500));

      const opt = {
        margin:       10,
        filename:     `${(liveQuizData?.title || 'report').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_Ranked_Report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css', avoid: '.avoid-page-break' }
      };

      await html2pdf().set(opt).from(container).save();

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Error during PDF generation: ' + err.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };"""
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

# Replace handleDownloadQuestionPaper
def replace_question_paper(content):
    pattern = r"const handleDownloadQuestionPaper = async \(\) => \{.*?finally \{\s*setIsDownloadingPaper\(false\);\s*\}\s*\};"
    replacement = """const handleDownloadQuestionPaper = async () => {
    if (!selectedQuiz) return;
    setIsDownloadingPaper(true);
    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableQuestionPaper
          questions={questions}
          hubName={hubData?.hubName || hub?.hubName || hubName || 'Event'}
          quizTitle={selectedQuiz.title}
          timeLimit={selectedQuiz.timeLimit || 0}
        />
      );

      // Give React time to render
      await new Promise(resolve => setTimeout(resolve, 500));

      const opt = {
        margin:       10,
        filename:     `${selectedQuiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_Question_Paper.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css', avoid: '.avoid-page-break' }
      };

      await html2pdf().set(opt).from(container).save();

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error('PDF Question Paper generation error:', err);
      alert('Error during PDF Question Paper generation: ' + err.message);
    } finally {
      setIsDownloadingPaper(false);
    }
  };"""
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

# Replace handleDownloadAuditPDF
def replace_audit_pdf(content):
    pattern = r"const handleDownloadAuditPDF = async \(\) => \{.*?finally \{\s*setIsDownloadingAudit\(false\);\s*\}\s*\};"
    replacement = """const handleDownloadAuditPDF = async () => {
    if (!auditAttempt) return;
    setIsDownloadingAudit(true);
    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Render React component into container
      const root = createRoot(container);
      root.render(
        <PrintableReport
          attempt={auditAttempt}
          questions={auditQuestions}
          hubName={hubData?.hubName || hub?.hubName || hubName || 'Event'}
        />
      );

      // Give React time to render
      await new Promise(resolve => setTimeout(resolve, 500));

      const opt = {
        margin:       10,
        filename:     `${auditAttempt.userId}_Forensic_Audit.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css', avoid: '.avoid-page-break' }
      };

      await html2pdf().set(opt).from(container).save();

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err: any) {
      console.error('PDF Audit Report generation error:', err);
      alert('Error during PDF Audit Report generation: ' + err.message);
    } finally {
      setIsDownloadingAudit(false);
    }
  };"""
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

content = replace_ranked_report(content)
content = replace_question_paper(content)
content = replace_audit_pdf(content)

# Remove the hidden templates from the JSX
pattern_templates = r"\{/\* Hidden Question Paper Template for PDF Generation \*/\}.*?id=\"hidden-audit-pdf-template\".*?<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}"

with open('src/pages/OrganizerDashboard.tsx', 'w') as f:
    f.write(content)

