const fs = require('fs');

let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace('export const Sidebar: React.FC = () => {', 
`import { X } from 'lucide-react';
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {`);

// Change the hidden md:flex to conditional classes based on isOpen
sidebarCode = sidebarCode.replace('className="w-64 bg-brand-card border-r border-brand-border hidden md:flex flex-col flex-shrink-0"', 
'className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-brand-card border-r border-brand-border flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}');

// Add close button for mobile inside the nav or top
sidebarCode = sidebarCode.replace('<nav className="flex-1 px-4 space-y-2">',
`
<div className="flex justify-end px-4 md:hidden mb-4">
  <button onClick={onClose} className="p-2 text-brand-text hover:bg-brand-bg rounded-lg">
    <X className="w-5 h-5" />
  </button>
</div>
<nav className="flex-1 px-4 space-y-2">
`);

// Add the backdrop
sidebarCode = sidebarCode.replace('</motion.aside>',
`</motion.aside>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}`);

fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);
