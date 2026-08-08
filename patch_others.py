import re

def add_logo(file, is_scoreboard):
    with open(file, 'r') as f:
        content = f.read()

    content = content.replace(
        "hubName: string;",
        "hubName: string;\n  logoUrl?: string;"
    )

    if is_scoreboard:
        content = content.replace(
            "reportDesignation, \n  primaryThemeColor \n}) => {",
            "reportDesignation, \n  primaryThemeColor,\n  logoUrl \n}) => {"
        )
        content = content.replace(
            '<h1 className="text-3xl font-black uppercase tracking-widest text-black mb-2 m-0" style={{ letterSpacing: \'0.1em\' }}>\n          {hubName || \'Institution / Event\'}\n        </h1>',
            """<div className="flex items-center justify-center gap-4 mb-2">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" referrerPolicy="no-referrer" />}
          <h1 className="text-3xl font-black uppercase tracking-widest text-black m-0" style={{ letterSpacing: '0.1em' }}>
            {hubName || 'Institution / Event'}
          </h1>
        </div>"""
        )
    else:
        content = content.replace(
            "export const PrintableQuestionPaper: React.FC<PrintableQuestionPaperProps> = ({ questions, hubName, quizTitle, timeLimit }) => {",
            "export const PrintableQuestionPaper: React.FC<PrintableQuestionPaperProps> = ({ questions, hubName, quizTitle, timeLimit, logoUrl }) => {"
        )
        content = content.replace(
            '<h1 className="text-2xl font-bold uppercase tracking-wider mb-2">{hubName || \'Institution / Event\'}</h1>',
            """<div className="flex justify-center items-center gap-4 mb-2">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />}
          <h1 className="text-2xl font-bold uppercase tracking-wider m-0">{hubName || 'Institution / Event'}</h1>
        </div>"""
        )

    with open(file, 'w') as f:
        f.write(content)

add_logo('src/components/PrintableQuestionPaper.tsx', False)
add_logo('src/components/PrintableScoreboard.tsx', True)
