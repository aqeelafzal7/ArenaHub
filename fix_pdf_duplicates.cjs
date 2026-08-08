const fs = require('fs');

function fixDuplicates(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix multiple style tags
    content = content.replace(/style=\{\{ color: "#000000" \}\}\s*style=\{\{ backgroundColor: "#ffffff", color: "#000000" \}\}\s*style=\{\{ width: "800px", backgroundColor: "#ffffff", color: "#000000" \}\}/g, 'style={{ width: "800px", backgroundColor: "#ffffff", color: "#000000" }}');
    
    // Check if there are other duplicates
    content = content.replace(/style=\{[^\}]+\}\s*style=\{([^\}]+)\}/g, 'style={$1}'); // simplistic fallback
    
    fs.writeFileSync(filePath, content);
}

fixDuplicates('src/components/PrintableReport.tsx');
fixDuplicates('src/components/PrintableScoreboard.tsx');
fixDuplicates('src/components/PrintableQuestionPaper.tsx');
