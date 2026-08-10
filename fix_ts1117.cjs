const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

content = content.replace(
  'timeLimit: Number(quizTimeLimit),\n      passPercentage: Number(quizPassPercentage),',
  'passPercentage: Number(quizPassPercentage),'
);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
