const fs = require('fs');

let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

// Undo the bad replacements
content = content.replace(
  '        setLoading(true);\n        if (reason === "Timer Expired") {\n          setLoadingMessage("Examination window closed. Auto-submitting your final answers...");\n        } else {\n          setLoadingMessage("Submitting your answers...");\n        }',
  '        setLoading(true);'
);

content = content.replace(
  '      setLoading(true);\n        if (reason === "Timer Expired") {\n          setLoadingMessage("Examination window closed. Auto-submitting your final answers...");\n        } else {\n          setLoadingMessage("Submitting your answers...");\n        }',
  '      setLoading(true);'
);

content = content.replace(
  '        setLoading(true);\n        if (reason === "Timer Expired") {\n          setLoadingMessage("Examination window closed. Auto-submitting your final answers...");\n        } else {\n          setLoadingMessage("Submitting your answers...");\n        }',
  '        setLoading(true);'
);


// Now inject properly in handleSubmitQuiz
const properInjectionStr = `        setLoading(true);
        if (reason === "Timer Expired") {
          setLoadingMessage("Examination window closed. Auto-submitting your final answers...");
        } else {
          setLoadingMessage("Submitting your answers...");
        }`;

content = content.replace(
  /const handleSubmitQuiz = useCallback\([\s\S]*?setLoading\(true\);/,
  function (match) {
    return match.replace('setLoading(true);', properInjectionStr);
  }
);

fs.writeFileSync('src/pages/QuizSession.tsx', content);
