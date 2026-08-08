git checkout src/pages/QuizSession.tsx || echo "No git repo"
cp /tmp/QuizSession_backup.tsx src/pages/QuizSession.tsx

# Delete the exact old code cleanly without regex matching braces.
# We will just write a new file.

node -e "
const fs = require('fs');
let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

const p1 = content.indexOf('{/* 1. PORTAL ACCESS (HUB ENTRY SCREEN) */}');
const p2 = content.indexOf('{isQuizStarted && activeQuiz && quizQuestions.length > 0 && (');

if (p1 !== -1 && p2 !== -1) {
    content = content.substring(0, p1) + content.substring(p2);
    fs.writeFileSync('src/pages/QuizSession.tsx', content);
    console.log('Fixed file cleanly!');
} else {
    console.log('Could not find markers', p1, p2);
}
"
