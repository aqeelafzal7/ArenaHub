const fs = require('fs');

const code = fs.readFileSync('src/pages/QuizSession.tsx', 'utf8');
const stack = [];
let i = 0;
// simple jsx parser is hard.
// Let's use typescript compiler API properly this time.
