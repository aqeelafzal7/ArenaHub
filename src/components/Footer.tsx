import React from 'react';
import { Code2, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  // Automatically gets the current year from the user's system/server
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto relative overflow-hidden" id="global-footer">
      {/* Subtle top border gradient */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent opacity-50"></div>
      
      {/* Frosted glass background */}
      <div className="bg-brand-bg/60 backdrop-blur-md px-6 py-6 border-t border-brand-border/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Copyright Section */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-bold text-brand-text tracking-wide">
              ArenaHub Platform
            </span>
            <span className="text-xs font-medium text-brand-muted mt-1">
              &copy; {currentYear} All rights reserved.
            </span>
          </div>

          {/* Developer Credit Section */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-card border border-brand-border/50 shadow-sm transition-all hover:border-brand-primary/40 hover:shadow-brand-primary/10">
            <Code2 className="h-4 w-4 text-brand-primary"/>
            <span className="text-xs font-bold text-brand-muted tracking-wide">
              Developed by <span className="text-brand-primary font-black ml-1 transition-colors hover:text-white cursor-default">M Aqeel Afzal</span>
            </span>
            <Sparkles className="h-3.5 w-3.5 text-brand-primary/70"/>
          </div>

        </div>
      </div>
    </footer>
  );
};
