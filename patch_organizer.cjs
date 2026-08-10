const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

// 1. Add state variables
content = content.replace(
  'const [closeAt, setCloseAt] = useState<string>("");',
  `const [closeAt, setCloseAt] = useState<string>("");
  const [isPerQuestionTimer, setIsPerQuestionTimer] = useState(false);
  const [timePerQuestionSeconds, setTimePerQuestionSeconds] = useState(15);`
);

// 2. Set them when a quiz is selected
content = content.replace(
  'setCloseAt(quiz.closeAt ? new Date(quiz.closeAt).toISOString().slice(0, 16) : "");',
  `setCloseAt(quiz.closeAt ? new Date(quiz.closeAt).toISOString().slice(0, 16) : "");
    setIsPerQuestionTimer(quiz.perQuestionTimer || false);
    setTimePerQuestionSeconds(quiz.timePerQuestionSeconds || 15);`
);

// 3. handleSaveConstraints
content = content.replace(
  'postSubmissionText: postSubmissionText.trim(),',
  `postSubmissionText: postSubmissionText.trim(),
      perQuestionTimer: isPerQuestionTimer,
      timePerQuestionSeconds: isPerQuestionTimer ? Number(timePerQuestionSeconds) : undefined,
      timeLimit: !isPerQuestionTimer ? Number(quizTimeLimit) : selectedQuiz.timeLimit,`
);

content = content.replace(
  /await updateDoc\(doc\(db, "quizzes", selectedQuiz\.id\), updatedFields\);/,
  `await updateDoc(doc(db, "quizzes", selectedQuiz.id), updatedFields);
      if (hub) {
        await updateDoc(doc(db, "hubs", hub.id), {
          settings: {
            isPerQuestionTimer,
            timePerQuestionSeconds: isPerQuestionTimer ? Number(timePerQuestionSeconds) : 0,
            totalDurationMinutes: !isPerQuestionTimer ? Number(quizTimeLimit) : 0
          }
        });
      }`
);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
