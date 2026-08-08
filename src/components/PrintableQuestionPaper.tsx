import React from "react";
import { Question } from "../types";

interface PrintableQuestionPaperProps {
  questions: Question[];
  hubName: string;
  logoUrl?: string;
  quizTitle: string;
  timeLimit: number;
}

export const PrintableQuestionPaper: React.FC<PrintableQuestionPaperProps> = ({
  questions,
  hubName,
  quizTitle,
  timeLimit,
  logoUrl,
}) => {
  return (
    <div
      id="pdf-question-paper-container"
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
        <h2 className="text-xl font-bold mb-2">{quizTitle}</h2>
        <p className="text-sm font-semibold m-0" style={{ color: "#374151" }}>
          Official Question Paper - Total Questions: {questions.length} - Time:{" "}
          {timeLimit || 0} mins
        </p>

        <div
          className="flex justify-between mt-6 max-w-lg mx-auto border p-4 rounded text-left"
          style={{ borderColor: "#d1d5db" }}
        >
          <div className="text-sm font-bold" style={{ color: "#1f2937" }}>
            Student Name:{" "}
            <span className="font-normal" style={{ color: "#9ca3af" }}>
              ___________________________
            </span>
          </div>
          <div className="text-sm font-bold" style={{ color: "#1f2937" }}>
            Roll No / CNIC:{" "}
            <span className="font-normal" style={{ color: "#9ca3af" }}>
              ___________________________
            </span>
          </div>
        </div>
      </div>

      <div className="text-left mb-10">
        {questions.map((q, qIndex) => (
          <div
            key={q.id || qIndex}
            className="avoid-page-break mb-6 border-b pb-4"
            style={{ borderColor: "#f3f4f6" }}
          >
            <p
              className="text-sm font-bold mb-3 leading-relaxed"
              style={{ color: "#000000" }}
            >
              Q{qIndex + 1}. {q.text}
            </p>
            {q.imageUrl && (
              <img
                src={q.imageUrl}
                alt="Question"
                className="max-h-40 object-contain mb-3 rounded"
              />
            )}
            <div className="grid grid-cols-2 gap-3 pl-6">
              {q.options.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  className="text-sm"
                  style={{ color: "#1f2937" }}
                >
                  <span className="font-bold mr-2" style={{ color: "#000000" }}>
                    {String.fromCharCode(65 + oIdx)})
                  </span>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="avoid-page-break mt-10 pt-6 border-t-2 border-dashed"
        style={{ borderColor: "#9ca3af" }}
      >
        <h2
          className="text-lg font-bold border-b-2 pb-2 mb-6 text-center uppercase tracking-wider"
          style={{ borderColor: "#000000", color: "#000000" }}
        >
          Official Answer Key
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {questions.map((q, qIndex) => (
            <div
              key={q.id || qIndex}
              className="text-sm flex items-start gap-1"
              style={{ color: "#111827" }}
            >
              <span className="font-bold whitespace-nowrap">
                Q{qIndex + 1}:
              </span>
              <span>
                Option{" "}
                <span className="font-bold">
                  {String.fromCharCode(65 + q.correctOption)}
                </span>{" "}
                - {q.options[q.correctOption]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
