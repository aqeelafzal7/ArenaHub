const fs = require('fs');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace basic text and background colors with inline styles or generic classes (since html2canvas supports basic HEX colors better, we will inject style props)
    // Actually, we can just replace the class strings with styles.
    // Or we can just use simple string replacements.

    // Remove text-gray-* text-black text-red-600 text-green-600 bg-white bg-gray-*
    // and add style prop where needed.

    // Since these are React components, it's easier to just remove color-related classes and append style objects.

    // A fast way is to just do it via regex
    content = content.replace(/className="(.*?)\s*bg-white\s*(.*?)"/g, 'className="$1 $2" style={{ backgroundColor: "#ffffff", color: "#000000" }}');
    content = content.replace(/className="(.*?)\s*text-black\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#000000" }}');
    content = content.replace(/className="(.*?)\s*text-red-600\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#dc2626" }}');
    content = content.replace(/className="(.*?)\s*text-green-600\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#16a34a" }}');
    content = content.replace(/className="(.*?)\s*text-gray-900\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#111827" }}');
    content = content.replace(/className="(.*?)\s*text-gray-800\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#1f2937" }}');
    content = content.replace(/className="(.*?)\s*text-gray-700\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#374151" }}');
    content = content.replace(/className="(.*?)\s*text-gray-600\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#4b5563" }}');
    content = content.replace(/className="(.*?)\s*text-gray-500\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#6b7280" }}');
    content = content.replace(/className="(.*?)\s*text-gray-400\s*(.*?)"/g, 'className="$1 $2" style={{ color: "#9ca3af" }}');
    content = content.replace(/className="(.*?)\s*bg-gray-100\s*(.*?)"/g, 'className="$1 $2" style={{ backgroundColor: "#f3f4f6" }}');
    
    // Some lines might not have styles but just dynamic classnames like `text-xs ${textColor}`
    content = content.replace(/let textColor = "text-gray-700";/g, 'let textColor = "#374151";');
    content = content.replace(/textColor = "text-green-600 font-bold";/g, 'textColor = "#16a34a";');
    content = content.replace(/textColor = "text-red-600 font-bold";/g, 'textColor = "#dc2626";');
    
    // In PrintableReport, the dynamic styling:
    content = content.replace(/className=\{\`text-xs \$\{textColor\}\`\}/g, 'className="text-xs" style={{ color: textColor }}');
    
    // The main container in all 3 components:
    content = content.replace(/style=\{\{ width: '800px' \}\}/g, "style={{ width: '800px', backgroundColor: '#ffffff', color: '#000000' }}");

    fs.writeFileSync(filePath, content);
}

processFile('src/components/PrintableReport.tsx');
processFile('src/components/PrintableScoreboard.tsx');
processFile('src/components/PrintableQuestionPaper.tsx');
