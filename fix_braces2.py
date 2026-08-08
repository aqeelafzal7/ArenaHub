import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')
for i in range(len(lines)-1, -1, -1):
    if lines[i] == '  );;':
        lines[i] = '  );\n};'
        break

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write('\n'.join(lines))
