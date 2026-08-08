import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Let's count open/close braces
o = content.count('{')
c = content.count('}')
print(f"Open: {o}, Close: {c}")

if c > o:
    print("Trying to fix by removing extra '}' near the end")
    
    # the last 30 lines
    lines = content.split('\n')
    for i in range(len(lines)-1, -1, -1):
        if '}' in lines[i]:
            print(f"Found }} at {i+1}: {lines[i]}")
            # wait, if I remove one of the extra '}' it might fix it.
