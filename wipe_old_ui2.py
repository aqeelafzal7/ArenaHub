import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# the FIRST return is for VideoPreview! Oh!
# I need to find the return statement of QuizSession component!

comp_start = content.find('export const QuizSession: React.FC = () => {')
return_idx = content.find('  return (', comp_start)

exam_start_idx = content.find('{isQuizStarted && activeQuiz && quizQuestions.length > 0 && (')

if return_idx != -1 and exam_start_idx != -1:
    content = content[:return_idx] + '  return (\n    <PwaGateway>\n      <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>\n      <canvas ref={canvasRef} className="hidden" width={640} height={480} />\n      ' + content[exam_start_idx:]

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
