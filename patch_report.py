import re

with open('src/components/PrintableReport.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "interface PrintableReportProps {",
    "interface PrintableReportProps {\n  logoUrl?: string;"
)
content = content.replace(
    "export const PrintableReport: React.FC<PrintableReportProps> = ({ attempt, questions, hubName }) => {",
    "export const PrintableReport: React.FC<PrintableReportProps> = ({ attempt, questions, hubName, logoUrl }) => {"
)
content = content.replace(
    '<h1 className="text-2xl font-bold uppercase tracking-wider mb-2">{hubName || \'Institution / Event\'}</h1>',
    """<div className="flex justify-center items-center gap-4 mb-2">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />}
          <h1 className="text-2xl font-bold uppercase tracking-wider m-0">{hubName || 'Institution / Event'}</h1>
        </div>"""
)

with open('src/components/PrintableReport.tsx', 'w') as f:
    f.write(content)
