import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace QuizHub with ParticipantDashboard and add PreFlight and QuizSession
content = content.replace("import { QuizHub } from './pages/QuizHub';", "import { ParticipantDashboard } from './pages/ParticipantDashboard';\nimport { PreFlight } from './pages/PreFlight';\nimport { QuizSession } from './pages/QuizSession';")

content = content.replace("<PwaGateway><QuizHub /></PwaGateway>", "<PwaGateway><ParticipantDashboard /></PwaGateway>")

routes_to_add = """          {/* Settings Route */}"""
new_routes = """          {/* Pre-Flight */}
          <Route path="/quiz/:quizId/pre-flight" element={
            <ProtectedRoute allowedRoles={['participant', 'Participant']}>
              <PwaGateway><PreFlight /></PwaGateway>
            </ProtectedRoute>
          } />
          {/* Quiz Session */}
          <Route path="/quiz/:quizId/session" element={
            <ProtectedRoute allowedRoles={['participant', 'Participant']}>
              <PwaGateway><QuizSession /></PwaGateway>
            </ProtectedRoute>
          } />
          
          {/* Settings Route */}"""

content = content.replace(routes_to_add, new_routes)

with open('src/App.tsx', 'w') as f:
    f.write(content)
