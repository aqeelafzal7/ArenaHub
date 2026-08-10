const fs = require('fs');

let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

// Replace boolean loading state with string loadingMessage state
content = content.replace(
  'const [loading, setLoading] = useState(true);',
  'const [loading, setLoading] = useState(true);\n  const [loadingMessage, setLoadingMessage] = useState("Loading assessment...");'
);

// update setLoading(true) in handleSubmitQuiz
content = content.replace(
  'setLoading(true);',
  'setLoading(true);\n        if (reason === "Timer Expired") {\n          setLoadingMessage("Examination window closed. Auto-submitting your final answers...");\n        } else {\n          setLoadingMessage("Submitting your answers...");\n        }'
);

// replace the loading text in the render
content = content.replace(
  '<p className="text-sm font-bold text-brand-text">Loading assessment...</p>',
  '<p className="text-sm font-bold text-brand-text">{loadingMessage}</p>'
);

fs.writeFileSync('src/pages/QuizSession.tsx', content);
