import re

with open('src/pages/QuizSession.tsx', 'r') as f:
    content = f.read()

# Replace the render block manually
new_render = """  return (
    <PwaGateway>
      <div className="max-w-4xl mx-auto px-4 py-8" style={tenantColors}>
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />
      
      {/* 4. EXAM INTERFACE */}
"""

# Find the start of 4. EXAM INTERFACE
start_idx = content.find("{/* 4. EXAM INTERFACE */}")
if start_idx != -1:
    # Find the main return by looking for the one right before `{/* 1. PORTAL ACCESS (HUB ENTRY SCREEN) */}`
    portal_access_idx = content.find("{/* 1. PORTAL ACCESS (HUB ENTRY SCREEN) */}")
    return_idx = content.rfind("  return (\n", 0, portal_access_idx)
    
    if return_idx != -1:
        content = content[:return_idx] + new_render + content[start_idx + len("{/* 4. EXAM INTERFACE */}"):]

with open('src/pages/QuizSession.tsx', 'w') as f:
    f.write(content)
