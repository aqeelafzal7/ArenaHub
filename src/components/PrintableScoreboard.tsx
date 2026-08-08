import React from "react";

interface PrintableScoreboardProps {
  quizTitle: string;
  hubName: string;
  logoUrl?: string;
  attempts: any[];
  reportSignatoryName: string;
  reportDesignation: string;
  primaryThemeColor: string;
}

export const PrintableScoreboard: React.FC<PrintableScoreboardProps> = ({
  quizTitle,
  hubName,
  attempts,
  reportSignatoryName,
  reportDesignation,
  primaryThemeColor,
  logoUrl,
}) => {
  return (
    <div
      id="pdf-scoreboard-container"
      className="p-10"
      style={{ width: "800px", backgroundColor: "#ffffff", color: "#000000" }}
    >
      <div
        className="border-b-[3px] pb-6 mb-8 text-center flex flex-col items-center"
        style={{ borderColor: "#000000" }}
      >
        <div className="flex items-center justify-center gap-4 mb-2">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-16 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <h1
            className="text-3xl font-black uppercase tracking-widest m-0"
            style={{ color: "#000000", letterSpacing: "0.1em" }}
          >
            {hubName || "Institution / Event"}
          </h1>
        </div>
        <h2
          className="text-xl font-bold uppercase tracking-widest mb-2 m-0"
          style={{ color: "#6b7280" }}
        >
          Ranked Performance Report
        </h2>
        <div
          className="text-lg font-bold mt-2 py-2 px-6 rounded inline-block"
          style={{ backgroundColor: "#f3f4f6", color: "#111827" }}
        >
          {quizTitle}
        </div>
      </div>

      <table className="w-full text-left border-collapse mt-4">
        <thead>
          <tr
            className="border-b-2"
            style={{ borderColor: "#000000", backgroundColor: "#f3f4f6" }}
          >
            <th
              className="py-3 px-4 font-black text-sm uppercase tracking-wider"
              style={{ color: "#000000" }}
            >
              Rank
            </th>
            <th
              className="py-3 px-4 font-black text-sm uppercase tracking-wider"
              style={{ color: "#000000" }}
            >
              Participant ID
            </th>
            <th
              className="py-3 px-4 font-black text-sm uppercase tracking-wider"
              style={{ color: "#000000" }}
            >
              Score
            </th>
            <th
              className="py-3 px-4 font-black text-sm uppercase tracking-wider"
              style={{ color: "#000000" }}
            >
              Completion Date
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((att, idx) => (
            <tr
              key={att.id}
              className="avoid-page-break border-b"
              style={{ borderColor: "#e5e7eb" }}
            >
              <td
                className="py-3 px-4 text-sm font-bold"
                style={{ color: "#000000" }}
              >
                {idx + 1}
              </td>
              <td
                className="py-3 px-4 text-sm font-mono"
                style={{ color: "#1f2937" }}
              >
                {att.userId}
              </td>
              <td
                className="py-3 px-4 text-sm font-bold"
                style={{ color: "#000000" }}
              >
                {att.score}
              </td>
              <td className="py-3 px-4 text-sm" style={{ color: "#6b7280" }}>
                {new Date(att.startedAt || Date.now()).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="avoid-page-break mt-20 border-t-2 pt-5 flex justify-end"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="text-right w-80">
          <div
            className="italic text-3xl mb-1"
            style={{
              fontFamily:
                "'Augustia', 'Great Vibes', 'Georgia', 'Times New Roman', serif",
              color: primaryThemeColor,
              letterSpacing: "0.02em",
            }}
          >
            {reportSignatoryName || "Authorized Signature"}
          </div>
          <div
            className="text-[10px] font-black tracking-[0.15em] uppercase"
            style={{ color: "#4b5563" }}
          >
            {reportDesignation || "SIGNATORY DEPARTMENT / DESIGNATION"}
          </div>
        </div>
      </div>
    </div>
  );
};
