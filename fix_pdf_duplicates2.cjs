const fs = require('fs');

function combineStyles(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Combine two style props into one
    // e.g. style={{ color: "#000000" }} style={{ letterSpacing: "0.1em" }} -> style={{ color: "#000000", letterSpacing: "0.1em" }}
    content = content.replace(/style=\{\{\s*([^}]+)\s*\}\}\s*style=\{\{\s*([^}]+)\s*\}\}/g, 'style={{ $1, $2 }}');
    
    fs.writeFileSync(filePath, content);
}

combineStyles('src/components/PrintableScoreboard.tsx');
combineStyles('src/components/PrintableQuestionPaper.tsx');
