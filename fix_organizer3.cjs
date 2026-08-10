const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

content = content.replace(
  /const updatedFields: Partial<Quiz> = \{\n      totalAttemptsAllowed: Number\(totalAttemptsAllowed\),\n      allowedCnics: allowedCnics,\n      openAt: openAt \? new Date\(openAt\)\.toISOString\(\) : "",\n      closeAt: closeAt \? new Date\(closeAt\)\.toISOString\(\) : "",\n      postSubmissionText: postSubmissionText\.trim\(\),\n    \};/,
  `const updatedFields: Partial<Quiz> = {
      totalAttemptsAllowed: Number(totalAttemptsAllowed),
      allowedCnics: allowedCnics,
      openAt: openAt ? new Date(openAt).toISOString() : "",
      closeAt: closeAt ? new Date(closeAt).toISOString() : "",
      postSubmissionText: postSubmissionText.trim(),
      perQuestionTimer: isPerQuestionTimer,
      timePerQuestionSeconds: isPerQuestionTimer ? Number(timePerQuestionSeconds) : undefined,
      timeLimit: !isPerQuestionTimer ? Number(quizTimeLimit) : 0,
    };`
);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
