import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

portal_start = content.find('{/* 1. PORTAL ACCESS (HUB ENTRY SCREEN) */}')
exam_start = content.find('{isQuizStarted && activeQuiz && quizQuestions.length > 0 && (')

if portal_start != -1 and exam_start != -1:
    content = content[:portal_start] + content[exam_start:]
    print("Replaced!")

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
