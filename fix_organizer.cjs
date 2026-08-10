const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

content = content.replace(
  '<div className="col-span-1 md:col-span-2">',
  '<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="col-span-1 md:col-span-2">'
);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
