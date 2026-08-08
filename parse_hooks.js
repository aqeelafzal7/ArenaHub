const fs = require('fs');
const ts = require('typescript');

const sourceFile = ts.createSourceFile(
  'QuizSession.tsx',
  fs.readFileSync('src/pages/QuizSession.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true
);

function traverse(node, depth = 0) {
    // If it's a block, we check if it parses correctly.
    // TypeScript compiler API will naturally recover but we can look for parse errors.
}

console.log(sourceFile.parseDiagnostics);
