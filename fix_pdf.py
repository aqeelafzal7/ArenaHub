import re

with open('src/pages/OrganizerDashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("liveQuizData?.title", "quizzes.find(q => q.id === activeLiveQuizId)?.title")
content = content.replace("attempts={liveData}", "attempts={[...liveAttempts].sort((a, b) => b.score - a.score)}")
content = content.replace("const opt = {", "const opt: any = {")

with open('src/pages/OrganizerDashboard.tsx', 'w') as f:
    f.write(content)
