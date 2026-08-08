import re
with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# I also need to remove references to unused imports maybe?
# But typescript won't fail build for unused imports if noEmitOnError is not set, 
# wait no, `tsc --noEmit` fails on semantic errors, not usually on unused variables unless `noUnusedLocals` is true.

content = content.replace("const handleDismissWarning = () => {", "// removed")
content = content.replace("setWarningModalOpen(false);", "")
