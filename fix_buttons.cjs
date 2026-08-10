const fs = require('fs');

let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

// Hide Previous button
content = content.replace(
  'currentQuestionIdx > 0 && (',
  '!activeQuiz?.perQuestionTimer && currentQuestionIdx > 0 && ('
);

// Hide Skip button
content = content.replace(
  /\{currentQuestionIdx \+ 1 < quizQuestions\.length &&\n\s*!hasSelectedOption &&\n\s*!activeQuiz\?\.isLiveCompetition && \(/,
  `{!activeQuiz?.perQuestionTimer && currentQuestionIdx + 1 < quizQuestions.length &&
                !hasSelectedOption &&
                !activeQuiz?.isLiveCompetition && (`
);

fs.writeFileSync('src/pages/QuizSession.tsx', content);
