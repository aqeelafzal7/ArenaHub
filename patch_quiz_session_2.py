import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Replace the render block manually
# We want to remove the sections marked "1. PORTAL ACCESS (HUB ENTRY SCREEN)", "2. QUIZ SEARCH SCREEN", "3. PRE-FLIGHT (EXAM DETAILS SCREEN)"
# And leave "4. EXAM INTERFACE" and "5. SECURE Digital Scores Room" and "6. STRICT PROCTORING OPERATIONAL WARNING / LOCKOUT MODAL"

new_render = """  return (
    <PwaGateway>
      <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />
      
      {/* 4. EXAM INTERFACE */}
"""

# Find the start of 4. EXAM INTERFACE
start_idx = content.find("{/* 4. EXAM INTERFACE */}")
if start_idx != -1:
    content = content[:content.find("  return (\n")] + new_render + content[start_idx + len("{/* 4. EXAM INTERFACE */}"):]

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
