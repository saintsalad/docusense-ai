"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    Upload, X, CheckCircle, Database, Loader2,
    FileText, Sparkles, ChevronLeft, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Chunk {
    date: string
    text: string
}

type Step = "input" | "formatting" | "preview" | "saving" | "done"

const ACCEPTED_EXTENSIONS = [".txt", ".json", ".md", ".csv"]

const STEP_LABELS: Record<"input" | "preview" | "done", string> = {
    input: "Input",
    preview: "Review",
    done: "Done",
}

export default function FileUploader() {
    const [step, setStep] = useState<Step>("input")
    const [content, setContent] = useState("")
    const [sourceName, setSourceName] = useState("")
    const [isDragging, setIsDragging] = useState(false)
    const [chunks, setChunks] = useState<Chunk[]>([])
    const [error, setError] = useState<string | null>(null)
    const [savedCount, setSavedCount] = useState(0)

    const readFile = useCallback(async (file: File) => {
        const text = await file.text()
        setSourceName(file.name)
        setContent(text)
    }, [])

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) readFile(file)
        },
        [readFile]
    )

    const handleFormat = async () => {
        if (!content.trim()) return
        setStep("formatting")
        setError(null)

        try {
            const res = await fetch("/api/embed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            })

            const data: unknown = await res.json()

            if (!res.ok) {
                const msg = typeof data === "object" && data !== null && "error" in data
                    ? String((data as { error: unknown }).error)
                    : "Formatting failed"
                throw new Error(msg)
            }

            const chunks = (data as { chunks: Chunk[] }).chunks
            if (!chunks || chunks.length === 0) throw new Error("AI returned no chunks")

            setChunks(chunks)
            setStep("preview")
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setStep("input")
        }
    }

    const handleSave = async () => {
        if (chunks.length === 0) return
        setStep("saving")
        setError(null)

        try {
            const res = await fetch("/api/chroma/add-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chunks, source: sourceName || "manual" }),
            })

            const data: unknown = await res.json()

            if (!res.ok) {
                const msg = typeof data === "object" && data !== null && "error" in data
                    ? String((data as { error: unknown }).error)
                    : "Save failed"
                throw new Error(msg)
            }

            setSavedCount((data as { inserted: number }).inserted)
            setStep("done")
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setStep("preview")
        }
    }

    const reset = () => {
        setStep("input")
        setContent("")
        setSourceName("")
        setChunks([])
        setError(null)
        setSavedCount(0)
    }

    const removeChunk = (index: number) => {
        setChunks((prev) => prev.filter((_, i) => i !== index))
    }

    const isStepComplete = (s: "input" | "preview" | "done") => {
        if (s === "input") return step === "preview" || step === "saving" || step === "done"
        if (s === "preview") return step === "done"
        return false
    }

    const isStepActive = (s: "input" | "preview" | "done") => {
        if (s === "input") return step === "input" || step === "formatting"
        if (s === "preview") return step === "preview" || step === "saving"
        return step === "done"
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Knowledge Embedder</h2>
                <p className="text-muted-foreground mt-1">
                    Paste or upload text — AI formats it into chunks, then saves to your knowledge base
                </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                {(["input", "preview", "done"] as const).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                            isStepComplete(s) && "bg-green-500 text-white",
                            isStepActive(s) && !isStepComplete(s) && "bg-primary text-primary-foreground",
                            !isStepActive(s) && !isStepComplete(s) && "bg-muted text-muted-foreground",
                        )}>
                            {isStepComplete(s)
                                ? <CheckCircle className="h-4 w-4" />
                                : i + 1}
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">{STEP_LABELS[s]}</span>
                        {i < 2 && <div className="h-px w-8 bg-border" />}
                    </div>
                ))}
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    <X className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Step 1: Input */}
            {(step === "input" || step === "formatting") && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Upload className="h-4 w-4" />
                                Upload a File
                            </CardTitle>
                            <CardDescription>Supported: {ACCEPTED_EXTENSIONS.join(", ")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById("file-input")?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                )}
                            >
                                <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-sm font-medium mb-1">
                                    {sourceName ? sourceName : "Drop a file here or click to browse"}
                                </p>
                                <p className="text-xs text-muted-foreground">Content will appear in the text area below</p>
                                <input
                                    id="file-input"
                                    type="file"
                                    className="hidden"
                                    accept={ACCEPTED_EXTENSIONS.join(",")}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) readFile(file)
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-4 w-4" />
                                Knowledge Content
                            </CardTitle>
                            <CardDescription>
                                Paste text, notes, JSON, or any knowledge you want to embed
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Paste your text, notes, or JSON data here..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={12}
                                className="resize-none font-mono text-sm"
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    {content.length > 0 ? `${content.length} characters` : "Empty"}
                                </span>
                                <Button
                                    onClick={handleFormat}
                                    disabled={content.trim().length < 10 || step === "formatting"}
                                    className="gap-2"
                                >
                                    {step === "formatting" ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Formatting with AI...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            Format with AI
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Step 2: Preview chunks */}
            {(step === "preview" || step === "saving") && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Review Chunks
                                </CardTitle>
                                <CardDescription>
                                    Remove any chunks you don&apos;t want before saving
                                </CardDescription>
                            </div>
                            <Badge variant="secondary">{chunks.length} chunks</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {chunks.map((chunk, i) => (
                                <div key={i} className="flex gap-3 p-3 rounded-lg border bg-card group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Badge variant="outline" className="text-xs font-mono">
                                                {chunk.date}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">#{i + 1}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">{chunk.text}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeChunk(i)}
                                        disabled={step === "saving"}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setStep("input")}
                                disabled={step === "saving"}
                                className="gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={chunks.length === 0 || step === "saving"}
                                className="flex-1 gap-2"
                            >
                                {step === "saving" ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving to Knowledge Base...
                                    </>
                                ) : (
                                    <>
                                        <Database className="h-4 w-4" />
                                        Save {chunks.length} Chunk{chunks.length !== 1 ? "s" : ""} to Knowledge Base
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Done */}
            {step === "done" && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        <h3 className="text-2xl font-bold mb-2">Saved Successfully</h3>
                        <p className="text-muted-foreground mb-6">
                            {savedCount} chunk{savedCount !== 1 ? "s" : ""} added to your knowledge base
                        </p>
                        <Button onClick={reset} className="gap-2">
                            <Upload className="h-4 w-4" />
                            Embed More Knowledge
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
