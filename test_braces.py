import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

open_c = content.count('{')
close_c = content.count('}')
print(f"Open: {open_c}, Close: {close_c}")
