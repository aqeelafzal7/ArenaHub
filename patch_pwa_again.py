import re

with open('src/components/PwaGateway.tsx', 'r') as f:
    content = f.read()

if "useAuth" not in content:
    content = content.replace("import { Download } from 'lucide-react';", "import { Download } from 'lucide-react';\nimport { useAuth } from '../context/AuthContext';")

if "const { profile } = useAuth();" not in content:
    content = content.replace("export const PwaGateway: React.FC<PwaGatewayProps> = ({ children }) => {", "export const PwaGateway: React.FC<PwaGatewayProps> = ({ children }) => {\n  const { profile } = useAuth();")

if "if (isStandalone) {" in content:
    content = content.replace("if (isStandalone) {", "if (isStandalone || (profile?.role !== 'Participant' && profile?.role !== 'participant')) {")

with open('src/components/PwaGateway.tsx', 'w') as f:
    f.write(content)
