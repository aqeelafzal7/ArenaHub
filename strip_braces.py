import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# I will find the extra } by removing one } at the end and seeing if it builds.
lines = content.split('\n')
for i in range(len(lines)-1, -1, -1):
    if '}' in lines[i]:
        lines[i] = lines[i].replace('}', '', 1)
        break

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write('\n'.join(lines))
