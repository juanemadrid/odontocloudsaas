import React from "react";

const renderInline = (value, keyPrefix) =>
    String(value || "")
        .split(/(\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((part, index) => {
            const key = keyPrefix + "-" + index;

            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={key}>{part.slice(2, -2)}</strong>;
            }

            return <React.Fragment key={key}>{part}</React.Fragment>;
        });

export default function SafeMarkdown({ text, className = "" }) {
    if (!text) return null;

    const rootClass = ["space-y-2", "text-slate-700", "leading-relaxed", className]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={rootClass}>
            {String(text)
                .split(/\r?\n/)
                .map((rawLine, index) => {
                    const line = rawLine.trim();
                    const key = "safe-markdown-" + index;

                    if (!line) {
                        return <div key={key} className="h-1" aria-hidden="true" />;
                    }

                    if (line.startsWith("### ")) {
                        return (
                            <h3 key={key} className="font-bold text-slate-900">
                                {renderInline(line.slice(4), key)}
                            </h3>
                        );
                    }

                    if (line.startsWith("## ")) {
                        return (
                            <h2 key={key} className="text-base font-bold text-slate-900">
                                {renderInline(line.slice(3), key)}
                            </h2>
                        );
                    }

                    if (line.startsWith("- ")) {
                        return (
                            <div key={key} className="flex items-start gap-2">
                                <span aria-hidden="true">•</span>
                                <span>{renderInline(line.slice(2), key)}</span>
                            </div>
                        );
                    }

                    return <p key={key}>{renderInline(line, key)}</p>;
                })}
        </div>
    );
}
