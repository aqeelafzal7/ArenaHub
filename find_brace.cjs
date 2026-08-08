const fs = require('fs');

const code = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');
let openCount = 0;
for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') openCount++;
    if (code[i] === '}') openCount--;
    if (openCount < 0) {
        console.log(`Extra closing brace at index ${i}`);
        console.log(code.substring(i - 50, i + 50));
        break;
    }
}
console.log("End openCount: " + openCount);
