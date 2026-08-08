import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Let's count { and } in QuizSession.tsx
open_braces = content.count('{')
close_braces = content.count('}')

print(f"Open braces: {open_braces}")
print(f"Close braces: {close_braces}")
