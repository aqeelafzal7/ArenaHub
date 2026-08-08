import React from "react";
import { Attempt, Question } from "../types";

interface PrintableReportProps {
  logoUrl?: string;
  attempt: Attempt;
  questions: Question[];
  hubName: string;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  attempt,
  questions,
  hubName,
  logoUrl,
}) => {
  return (
    <div
      id="pdf-report-container"
      className="p-8"
      style={{ width: "800px", backgroundColor: "#ffffff", color: "#000000" }}
    >
      <div
        className="border-b-2 pb-6 mb-8 text-center"
        style={{ borderColor: "#000000" }}
      >
        <div className="flex justify-center items-center gap-4 mb-2">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <h1 className="text-2xl font-bold uppercase tracking-wider m-0">
            {hubName || "Institution / Event"}
          </h1>
        </div>
        <h2 className="text-xl font-bold mb-4">Forensic Audit Report</h2>
        <div
          className="flex justify-between items-start text-left mt-6 max-w-lg mx-auto border p-4 rounded"
          style={{ borderColor: "#d1d5db" }}
        >
          <div>
            <p className="text-sm font-bold mb-1">
              User ID: <span className="font-normal">{attempt.userId}</span>
            </p>
            <p className="text-sm font-bold mb-1">
              Score: <span className="font-normal">{attempt.score}</span>
            </p>
            <p className="text-sm font-bold">
              Attempted At:{" "}
              <span className="font-normal">
                {new Date(attempt.startedAt || Date.now()).toLocaleString()}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3
          className="text-lg font-bold border-b pb-2 mb-4"
          style={{ borderColor: "#d1d5db" }}
        >
          Forensic Cheating Log
        </h3>
        {attempt.cheatFlags && attempt.cheatFlags.length > 0 ? (
          <ul
            className="list-disc pl-5 space-y-2 text-sm"
            style={{ color: "#dc2626" }}
          >
            {attempt.cheatFlags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-bold" style={{ color: "#16a34a" }}>
            No suspicious activities flagged.
          </p>
        )}
      </div>

      <div>
        <h3
          className="text-lg font-bold border-b pb-2 mb-4"
          style={{ borderColor: "#d1d5db" }}
        >
          Question Responses
        </h3>
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="avoid-page-break mb-6 border-b pb-4"
            style={{ borderColor: "#f3f4f6" }}
          >
            <p className="text-sm font-bold mb-2">
              Q{idx + 1}. {q.text}
            </p>
            {q.imageUrl && (
              <img
                src={q.imageUrl}
                alt="Question"
                className="max-h-40 object-contain mb-2 rounded"
              />
            )}
            <div className="grid grid-cols-2 gap-2 pl-4">
              {q.options.map((opt, oIdx) => {
                const isCorrect = q.correctOption === oIdx;
                const isSelected = attempt.answers[q.id] === opt;

                let textColor = "#374151";
                if (isCorrect) textColor = "#16a34a";
                else if (isSelected && !isCorrect) textColor = "#dc2626";

                return (
                  <div
                    key={oIdx}
                    className="text-xs"
                    style={{ color: textColor }}
                  >
                    <span className="font-bold mr-1">
                      {String.fromCharCode(65 + oIdx)})
                    </span>{" "}
                    {opt}
                    {isSelected && " (Selected)"}
                    {isCorrect && " (Correct)"}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
