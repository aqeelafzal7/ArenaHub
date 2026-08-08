import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

content = content.replace("export const QuizHub: React.FC = () => {", "import { useParams, useNavigate } from 'react-router-dom';\n\nexport const QuizSession: React.FC = () => {\n  const { quizId } = useParams<{ quizId: string }>();\n  const navigate = useNavigate();")

# Remove handleLoadHub and handleLoadQuiz
# Actually, since it's a huge file, maybe I can just inject some useEffect to auto-load the quiz and start it?
# The code already has an hydration useEffect which checks `arena_active_session`.
# If `arena_active_session` is present and active, it loads the hub, quiz, questions, and attempt, then calls `setIsQuizStarted(true)`.

# Let's remove the first part of the render function which displays the "Enter Hub ID" and "Enter Quiz ID".
content = re.sub(r'\{!\(activeHub \&\& activeQuiz\) \&\& \!finalAttempt \&\& \(.*?\n\s+<\/motion\.div>\n\s+\)\}', '', content, flags=re.DOTALL)

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
