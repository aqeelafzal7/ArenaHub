const fs = require('fs');

function fixBorders(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // First replace border-black
    content = content.replace(/className="([^"]*)border-black([^"]*)"/g, (match, p1, p2) => {
        return `className="${p1}${p2}" style={{ borderColor: "#000000" }}`;
    });

    // border-gray-100
    content = content.replace(/className="([^"]*)border-gray-100([^"]*)"/g, (match, p1, p2) => {
        return `className="${p1}${p2}" style={{ borderColor: "#f3f4f6" }}`;
    });

    // border-gray-200
    content = content.replace(/className="([^"]*)border-gray-200([^"]*)"/g, (match, p1, p2) => {
        return `className="${p1}${p2}" style={{ borderColor: "#e5e7eb" }}`;
    });

    // border-gray-300
    content = content.replace(/className="([^"]*)border-gray-300([^"]*)"/g, (match, p1, p2) => {
        return `className="${p1}${p2}" style={{ borderColor: "#d1d5db" }}`;
    });

    // border-gray-400
    content = content.replace(/className="([^"]*)border-gray-400([^"]*)"/g, (match, p1, p2) => {
        return `className="${p1}${p2}" style={{ borderColor: "#9ca3af" }}`;
    });

    // Fix multiple styles again
    content = content.replace(/style=\{\{\s*([^}]+)\s*\}\}\s*style=\{\{\s*([^}]+)\s*\}\}/g, 'style={{ $1, $2 }}');
    content = content.replace(/style=\{\{\s*([^}]+)\s*\}\}\s*style=\{\{\s*([^}]+)\s*\}\}/g, 'style={{ $1, $2 }}');
    content = content.replace(/style=\{\{\s*([^}]+)\s*\}\}\s*style=\{\{\s*([^}]+)\s*\}\}/g, 'style={{ $1, $2 }}');
    
    // Clean up multiple spaces in className
    content = content.replace(/className="([^"]*)"/g, (match, p1) => {
        return `className="${p1.replace(/\s+/g, ' ').trim()}"`;
    });

    fs.writeFileSync(filePath, content);
}

fixBorders('src/components/PrintableReport.tsx');
fixBorders('src/components/PrintableScoreboard.tsx');
fixBorders('src/components/PrintableQuestionPaper.tsx');
