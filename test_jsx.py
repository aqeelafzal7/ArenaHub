import subprocess
with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Let's count JSX tags roughly
import re
tags = re.findall(r'<\/?([a-zA-Z0-9\.]+)[^>]*>', content)
# just looking at tags might not be perfect, but let's see what's going on.
