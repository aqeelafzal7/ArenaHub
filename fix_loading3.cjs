const fs = require('fs');

let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

// Ensure loadingMessage is declared
if (!content.includes('const [loadingMessage')) {
  content = content.replace(
    'const [loading, setLoading] = useState(false);',
    'const [loading, setLoading] = useState(false);\n  const [loadingMessage, setLoadingMessage] = useState("Loading assessment...");'
  );
}

fs.writeFileSync('src/pages/QuizSession.tsx', content);
