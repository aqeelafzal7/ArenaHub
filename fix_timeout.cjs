const fs = require('fs');

let content = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');

const targetStr = `      // Auto-submit current answer (or lack thereof) and move to next question
      if (currentQuestionIdx < quizQuestions.length - 1) {
        setCurrentQuestionIdx((p) => p + 1);
      } else {
        handleSubmitQuiz("Submitted");
      }`;

const newStr = `      // Auto-submit current answer (or lack thereof) and move to next question
      setAnswers((prev) => {
        const currentQ = quizQuestions[currentQuestionIdx];
        if (currentQ && !prev[currentQ.id]) {
          return { ...prev, [currentQ.id]: "TIMED_OUT" };
        }
        return prev;
      });

      if (currentQuestionIdx < quizQuestions.length - 1) {
        setCurrentQuestionIdx((p) => p + 1);
      } else {
        handleSubmitQuiz("Submitted");
      }`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/pages/QuizSession.tsx', content);
