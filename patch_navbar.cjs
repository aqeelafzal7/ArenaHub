const fs = require('fs');

let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// Add Menu icon to imports
code = code.replace("import { LogOut, Sun, Moon, Eye, ShieldAlert } from 'lucide-react';", "import { LogOut, Sun, Moon, Eye, ShieldAlert, Menu } from 'lucide-react';");

// Add prop for onMenuClick
code = code.replace("export const Navbar: React.FC = () => {", 
`interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {`);

// Add Hamburger menu next to branding
code = code.replace('<div className="flex items-center gap-3">',
`<div className="flex items-center gap-3">
          {onMenuClick && (
            <button 
              onClick={onMenuClick}
              className="p-2 -ml-2 text-brand-text hover:bg-brand-bg rounded-lg md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}`);

fs.writeFileSync('src/components/Navbar.tsx', code);
