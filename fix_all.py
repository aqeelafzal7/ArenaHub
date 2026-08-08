import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

content = content.replace("      )}\n      )}\n      {/* 6. STRICT PROCTORING OPERATIONAL WARNING / LOCKOUT MODAL */}", "      )}\n      {/* 6. STRICT PROCTORING OPERATIONAL WARNING / LOCKOUT MODAL */}")

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
