const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add Sidebar import
code = code.replace("import { Navbar } from './components/Navbar';", "import { Navbar } from './components/Navbar';\nimport { Sidebar } from './components/Sidebar';");

// Add state for sidebar
code = code.replace('const AppContent: React.FC = () => {', 
`const AppContent: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);`);

// Modify the return statement
const returnStart = code.indexOf('return (');
const returnOld = code.substring(returnStart);

const returnNew = `return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {!isQuizStarted && <Navbar onMenuClick={() => setIsSidebarOpen(true)} />}
      <div className="flex flex-1 overflow-hidden">
        {!isQuizStarted && user && <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            {/* Public / Auth Route */}
            <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" replace />} />
            
            {/* Onboarding Route */}
            <Route path="/onboarding" element={user && hasIncompleteProfile ? <OnboardingPage /> : <Navigate to="/" replace />} />

            {/* Home Route - Redirects based on role or goes to Participant dashboard */}
            <Route path="/" element={
              !user ? <Navigate to="/login" replace /> :
              hasIncompleteProfile ? <Navigate to="/onboarding" replace /> :
              ['admin', 'super_admin', 'Organizer'].includes(profile?.role || '') ? <Navigate to="/admin" replace /> :
              <PwaGateway><ParticipantDashboard /></PwaGateway>
            } />

            {/* Admin Dashboard */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin', 'Organizer']}>
                <OrganizerDashboard />
              </ProtectedRoute>
            } />

            {/* Obscured Super Admin Panel */}
            <Route path="/sys-core-panel-x9v2" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />

            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="p-8 text-center bg-brand-surface border border-red-500 rounded-xl shadow-lg max-w-md w-full">
                  <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                  <p className="text-brand-text">You are not authorized to view this page.</p>
                </div>
              </div>
            } />

            {/* Catch-all route to prevent probing */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
      {!isQuizStarted && <Footer />}
    </div>
  );
};`;

code = code.substring(0, returnStart) + returnNew + '\n\n' + 'export default function App() {\n  return (\n    <Router>\n      <AuthProvider>\n        <AppContent />\n      </AuthProvider>\n    </Router>\n  );\n}';

fs.writeFileSync('src/App.tsx', code);
