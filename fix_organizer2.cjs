const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

content = content.replace(
  'timeLimit: !isPerQuestionTimer\n        ? Number(quizTimeLimit)\n        : selectedQuiz.timeLimit,',
  'timeLimit: !isPerQuestionTimer ? Number(quizTimeLimit) : 0,'
);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
