const fs = require('fs');

let content = fs.readFileSync('src/pages/OrganizerDashboard.tsx', 'utf8');

const injectionPoint = `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-brand-text mb-1">
                              Quiz Open Date & Time
                            </label>`;

const uiCode = `<div className="col-span-1 md:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer p-3 bg-brand-bg border border-brand-border rounded-lg mb-4 hover:bg-brand-primary/5 transition-colors">
                              <input
                                type="checkbox"
                                checked={isPerQuestionTimer}
                                onChange={(e) => setIsPerQuestionTimer(e.target.checked)}
                                className="w-4 h-4 text-brand-primary border-brand-border rounded focus:ring-brand-primary"
                              />
                              <span className="text-xs font-bold text-brand-text">
                                Enforce Per-Question Timer
                              </span>
                            </label>
                            {isPerQuestionTimer ? (
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-brand-text mb-1">
                                  Seconds per Question
                                </label>
                                <input
                                  type="number"
                                  min="5"
                                  value={timePerQuestionSeconds}
                                  onChange={(e) => setTimePerQuestionSeconds(Number(e.target.value))}
                                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                                />
                              </div>
                            ) : (
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-brand-text mb-1">
                                  Total Quiz Duration (Minutes)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={quizTimeLimit}
                                  onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                                  className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-text text-xs focus:ring-1 focus:ring-brand-primary/30 outline-none"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-brand-text mb-1">
                              Quiz Open Date & Time
                            </label>`;

content = content.replace(injectionPoint, uiCode);

fs.writeFileSync('src/pages/OrganizerDashboard.tsx', content);
