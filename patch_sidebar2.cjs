const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace('<motion.aside', '<>\n<motion.aside');
code = code.replace(')}', ')}\n</>');

fs.writeFileSync('src/components/Sidebar.tsx', code);
