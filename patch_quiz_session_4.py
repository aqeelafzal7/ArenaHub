import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Replace the whole block from "return (\n    <PwaGateway>" up to "{/* 4. EXAM INTERFACE */}"
new_render = """  return (
    <PwaGateway>
      <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />
"""

portal_start = content.find("  return (\n    <PwaGateway>")
exam_start = content.find("{/* 4. EXAM INTERFACE */}")

if portal_start != -1 and exam_start != -1:
    content = content[:portal_start] + new_render + content[exam_start + len("{/* 4. EXAM INTERFACE */}"):]

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
