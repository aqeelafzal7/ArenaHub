import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# count total '{' and '}'
open_count = content.count('{')
close_count = content.count('}')

print(f"Open: {open_count}, Close: {close_count}")
