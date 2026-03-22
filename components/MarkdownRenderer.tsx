"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { memo, useMemo, useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import "highlight.js/styles/github-dark.css";

type MarkdownRendererProps = {
    content: string;
    showThinking?: boolean; // toggle reasoning visibility
};

type ReactMarkdownProps = ComponentProps<typeof ReactMarkdown>;

const REMARK_PLUGINS: NonNullable<ReactMarkdownProps["remarkPlugins"]> = [remarkGfm, remarkBreaks];

const REHYPE_PLUGINS: NonNullable<ReactMarkdownProps["rehypePlugins"]> = [
    rehypeRaw,
    [
        rehypeHighlight,
        {
            detect: true,
            ignoreMissing: true,
            subset: false,
        },
    ],
];

// Component for individual thinking blocks with smooth animations
const ThinkingBlock = memo(function ThinkingBlock({ children }: { children: React.ReactNode }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleToggle = () => {
        if (isAnimating) return; // Prevent rapid clicking during animation

        setIsAnimating(true);
        setIsExpanded(!isExpanded);

        // Reset animation flag after animation completes
        setTimeout(() => setIsAnimating(false), 300);
    };

    return (
        <div
            onClick={handleToggle}
            className={`
                mb-6 mt-2 text-sm block p-2 italic rounded-lg
                hover:text-slate-600 hover:cursor-pointer
                transition-all duration-500 ease-in-out
                ${
                    isExpanded
                        ? "text-slate-600 border-slate-300 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600"
                        : "text-slate-500 border-slate-200 dark:text-slate-400 dark:border-slate-700"
                }
                ${isAnimating ? "pointer-events-none" : "pointer-events-auto"}
            `}
        >
            <div className="flex items-center">
                <div
                    className={`
                    transform transition-transform duration-500 ease-in-out mr-1
                    ${isExpanded ? "rotate-180" : "rotate-0"}
                `}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                </div>
                <span className="text-xs font-medium tracking-wide">Thought for a moment...</span>
            </div>

            <div
                className={`
                overflow-hidden transition-all duration-500 ease-in-out ml-5
                ${isExpanded ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}
            `}
            >
                <div className="pt-2 text-sm leading-relaxed">{children}</div>
            </div>
        </div>
    );
});

const markdownComponents: Components = {
    h1: ({ children, ...props }) => (
        <h1
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 mt-6 first:mt-0"
            {...props}
        >
            {children}
        </h1>
    ),
    p: ({ children, ...props }) => (
        <span className="leading-relaxed text-gray-700 dark:text-gray-300" {...props}>
            {children}
        </span>
    ),
    div: ({ children, className, ...props }) => {
        if (className === "thinking-block") {
            return <ThinkingBlock>{children}</ThinkingBlock>;
        }
        return (
            <div className={className} {...props}>
                {children}
            </div>
        );
    },
    code({ children, className, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const isInline = !match;

        if (isInline) {
            return (
                <code
                    className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200"
                    {...props}
                >
                    {children}
                </code>
            );
        }

        return (
            <code
                className={`${className} bg-transparent p-0 text-sm font-mono text-gray-100`}
                {...props}
            >
                {children}
            </code>
        );
    },
};

function MarkdownRendererInner({ content, showThinking = false }: MarkdownRendererProps) {
    const cleanedContent = useMemo(
        () =>
            content.replace(
                /<think>([\s\S]*?)<\/think>/g,
                (_, match: string) =>
                    showThinking ? `\n<div class="thinking-block">${match.trim()}</div>\n` : ""
            ),
        [content, showThinking]
    );

    // Show typing indicator when content is empty
    if (!content || content.trim() === "") {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">AI is typing...</span>
            </div>
        );
    }

    return (
        <div className="prose prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
                components={markdownComponents}
            >
                {cleanedContent}
            </ReactMarkdown>
        </div>
    );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);
