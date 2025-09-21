"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Send, Plus, MessageSquare } from "lucide-react";
import { chatWithOllamaStream } from "@/lib/ollama";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

type Message = {
    id: string;
    sender: "me" | "ai";
    text: string;
};

export default function ChatbotUI() {
    const [conversations, setConversations] = useState<
        { id: string; messages: Message[] }[]
    >([
        {
            id: "conv-1",
            messages: [
                { id: "1", sender: "me", text: "Hello AI 👋" },
                { id: "2", sender: "ai", text: "Hey there! How can I help you today?" },
            ],
        },
        {
            id: "conv-2",
            messages: [],
        },
    ]);

    const [activeConv, setActiveConv] = useState("conv-1");
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentConv = conversations.find((c) => c.id === activeConv);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [currentConv?.messages]);

    // Create new conversation
    const createNewConversation = () => {
        const newConvId = `conv-${Date.now()}`;
        const newConv = {
            id: newConvId,
            messages: [],
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConv(newConvId);
    };


    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput(""); // Clear input immediately for better UX

        // Add user message to conversation
        const newUserMsg: Message = {
            id: Date.now().toString(),
            sender: "me",
            text: userMessage,
        };

        setConversations((prev) =>
            prev.map((c) =>
                c.id === activeConv
                    ? { ...c, messages: [...c.messages, newUserMsg] }
                    : c
            )
        );

        // Scroll to bottom immediately after user message
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        // Create AI message placeholder
        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg: Message = {
            id: aiMsgId,
            sender: "ai",
            text: "",
        };

        // Add empty AI message to show typing indicator
        setConversations((prev) =>
            prev.map((c) =>
                c.id === activeConv
                    ? { ...c, messages: [...c.messages, aiMsg] }
                    : c
            )
        );

        // Scroll to bottom after AI message placeholder is added
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);


        try {
            // Stream AI response
            let fullResponse = "";
            for await (const partial of chatWithOllamaStream([{ role: "user", content: userMessage }])) {
                fullResponse = partial; // Keep the full accumulated response
                setConversations((prev) =>
                    prev.map((c) =>
                        c.id === activeConv
                            ? {
                                ...c,
                                messages: c.messages.map((msg) =>
                                    msg.id === aiMsgId ? { ...msg, text: fullResponse } : msg
                                ),
                            }
                            : c
                    )
                );
            }
        } catch (error) {
            console.error("Error getting AI response:", error);

            // Update AI message with error
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConv
                        ? {
                            ...c,
                            messages: c.messages.map((msg) =>
                                msg.id === aiMsgId
                                    ? { ...msg, text: "Sorry, I encountered an error. Please try again." }
                                    : msg
                            ),
                        }
                        : c
                )
            );
        } finally {
            // Error handling complete
        }
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-950 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 border-r border-gray-200 dark:border-gray-800 backdrop-blur-lg p-4 flex flex-col bg-white/50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                        Conversations
                    </h2>
                    <Button
                        size="sm"
                        onClick={createNewConversation}
                        className="rounded-full h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <ScrollArea className="flex-1 -mx-2">
                    <div className="space-y-2 px-2">
                        {conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => setActiveConv(conv.id)}
                                className={cn(
                                    "w-full rounded-lg px-4 py-3 text-left transition-colors duration-200",
                                    activeConv === conv.id
                                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                        : "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                                )}
                            >
                                <div className="flex flex-col items-start w-full">
                                    <div className="flex items-center justify-between w-full mb-2">
                                        <span className="font-medium text-sm truncate flex-1 text-gray-800 dark:text-gray-100">
                                            {conv.messages.length > 0
                                                ? conv.messages[0]?.text?.slice(0, 30) + (conv.messages[0]?.text?.length > 30 ? "..." : "")
                                                : "New Conversation"
                                            }
                                        </span>
                                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                            {conv.messages.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs text-gray-500">
                                            {conv.messages.length > 0 ? "Active" : "Empty"}
                                        </span>
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            activeConv === conv.id
                                                ? "bg-blue-500"
                                                : "bg-gray-400 dark:bg-gray-500"
                                        )} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-h-0 ">
                {/* Messages */}
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-6 space-y-7 pb-10 max-w-3xl mx-auto">
                            {currentConv?.messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={cn(
                                        "rounded-3xl px-4 py-3 shadow-sm backdrop-blur-sm",
                                        msg.sender === "me"
                                            ? "ml-auto bg-blue-500 text-white max-w-xl w-fit"
                                            : "w-fit bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-2xl"
                                    )}
                                >
                                    {msg.sender === "ai" ? (
                                        <div className="w-full">
                                            <MarkdownRenderer content={msg.text || ""} showThinking={true} />
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap break-words">
                                            {msg.text}
                                        </span>
                                    )}
                                </motion.div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>
                </div>

                {/* Sticky Chatbox */}
                <div className="sticky bottom-0 bg-gradient-to-t from-gray-100/95 to-transparent dark:from-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3 max-w-3xl mx-auto">
                        <Textarea
                            value={input}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                            placeholder="Type your message... (Shift+Enter for new line)"
                            className="flex-1 rounded-2xl px-4 py-3 text-base shadow-lg border-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[48px]"
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            rows={1}
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="rounded-full shadow-lg h-12 w-12 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
