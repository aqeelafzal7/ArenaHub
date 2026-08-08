import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'const handleLoadHub = async \(.*?\{.*?^\s*};\n', '', content, flags=re.MULTILINE|re.DOTALL)
content = re.sub(r'const handleLoadQuiz = async \(.*?\{.*?^\s*};\n', '', content, flags=re.MULTILINE|re.DOTALL)
content = re.sub(r'const handleStartQuiz = async \(.*?\{.*?^\s*};\n', '', content, flags=re.MULTILINE|re.DOTALL)

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
