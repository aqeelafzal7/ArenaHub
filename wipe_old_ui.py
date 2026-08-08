import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

return_idx = content.find('  return (')

# Let's find exactly where the 4. EXAM INTERFACE starts.
# Actually I see {isQuizStarted && activeQuiz && quizQuestions.length > 0 && (
exam_start_idx = content.find('{isQuizStarted && activeQuiz && quizQuestions.length > 0 && (')

# And I want everything from return ( to PwaGateway> included, but delete all the old portal ui between <PwaGateway> and exam_start_idx.

if return_idx != -1 and exam_start_idx != -1:
    content = content[:return_idx] + '  return (\n    <PwaGateway>\n      <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>\n      <canvas ref={canvasRef} className="hidden" width={640} height={480} />\n      ' + content[exam_start_idx:]

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
