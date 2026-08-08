import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

return_idx = content.find('  return (')
print(content[return_idx:return_idx+500])
