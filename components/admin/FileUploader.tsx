"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, File, X, CheckCircle, Database, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadedFile {
    name: string
    size: string
    status: string
    chunks?: number
    error?: string
}

export default function FileUploader() {
    const [isDragging, setIsDragging] = useState(false)
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
    const [manualText, setManualText] = useState('')
    const [isUploading, setIsUploading] = useState(false)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        handleFiles(files)
    }

    const handleFiles = async (files: File[]) => {
        for (const file of files) {
            const newFile: UploadedFile = {
                name: file.name,
                size: formatBytes(file.size),
                status: 'processing'
            }

            setUploadedFiles(prev => [newFile, ...prev])

            try {
                const text = await file.text()
                const chunks = chunkText(text)

                // Insert chunks into vector DB
                const response = await fetch('http://localhost:4000/insert-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: chunks.map((chunk, i) => ({
                            id: `${file.name}_chunk_${i}`,
                            text: chunk
                        }))
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    setUploadedFiles(prev =>
                        prev.map(f =>
                            f.name === file.name
                                ? { ...f, status: 'completed', chunks: data.inserted }
                                : f
                        )
                    )
                } else {
                    throw new Error('Upload failed')
                }
            } catch {
                setUploadedFiles(prev =>
                    prev.map(f =>
                        f.name === file.name
                            ? { ...f, status: 'error', error: 'Failed to process file' }
                            : f
                    )
                )
            }
        }
    }

    const chunkText = (text: string, chunkSize = 500): string[] => {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
        const chunks: string[] = []
        let currentChunk = ''

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim())
                currentChunk = sentence
            } else {
                currentChunk += sentence
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim())
        return chunks
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    }

    const handleManualUpload = async () => {
        if (!manualText.trim()) return

        setIsUploading(true)
        const tempFileName = `Custom text (${new Date().toLocaleTimeString()})`

        // Add to UI immediately with processing status
        setUploadedFiles(prev => [{
            name: tempFileName,
            size: `${manualText.length} chars`,
            status: 'processing'
        }, ...prev])

        try {
            const response = await fetch('/api/chroma/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: manualText,
                    metadata: {
                        type: 'custom',
                    }
                })
            })

            const data = await response.json()

            if (response.ok && data.ok) {
                setUploadedFiles(prev =>
                    prev.map(f =>
                        f.name === tempFileName
                            ? { ...f, status: 'completed', chunks: 1, name: `Custom text: ${data.id.slice(0, 8)}...` }
                            : f
                    )
                )
                setManualText('')
            } else {
                throw new Error(data.error || 'Upload failed')
            }
        } catch (error) {
            console.error('Upload failed:', error)
            setUploadedFiles(prev =>
                prev.map(f =>
                    f.name === tempFileName
                        ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Failed to upload' }
                        : f
                )
            )
        } finally {
            setIsUploading(false)
        }
    }

    const removeFile = (fileName: string) => {
        setUploadedFiles(prev => prev.filter(f => f.name !== fileName))
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">File Uploader</h2>
                <p className="text-muted-foreground mt-1">
                    Upload documents to feed your chatbot&apos;s knowledge base
                </p>
            </div>

            {/* File Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload Files
                    </CardTitle>
                    <CardDescription>
                        Files will be automatically chunked and stored in the vector database
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                        )}
                    >
                        <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">Drop your files here</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Supported: .txt, .md, .json, .csv
                        </p>
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            multiple
                            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                            accept=".txt,.md,.json,.csv"
                        />
                        <Button onClick={() => document.getElementById('file-upload')?.click()}>
                            Browse Files
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Manual Text Input */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Add Custom Text
                    </CardTitle>
                    <CardDescription>
                        Add custom text directly to your knowledge base
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="Enter your text here... (e.g., notes, facts, information you want your chatbot to know)"
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        rows={8}
                        className="resize-none"
                    />
                    <Button
                        onClick={handleManualUpload}
                        disabled={isUploading || !manualText.trim()}
                        className="w-full gap-2"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Adding to Knowledge Base...
                            </>
                        ) : (
                            <>
                                <Database className="h-4 w-4" />
                                Add to Knowledge Base
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Upload History */}
            {uploadedFiles.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Upload History</CardTitle>
                        <CardDescription>
                            Recently uploaded files and their processing status
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {uploadedFiles.map((file, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={cn(
                                            "p-2 rounded-md",
                                            file.status === 'completed' && "bg-green-500/10",
                                            file.status === 'processing' && "bg-blue-500/10",
                                            file.status === 'error' && "bg-red-500/10"
                                        )}>
                                            {file.status === 'processing' ? (
                                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                            ) : file.status === 'error' ? (
                                                <X className="h-5 w-5 text-red-500" />
                                            ) : (
                                                <File className="h-5 w-5 text-green-500" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{file.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {file.size}
                                                {file.chunks && ` • ${file.chunks} chunks in vector DB`}
                                                {file.error && ` • ${file.error}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {file.status === 'completed' && (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => removeFile(file.name)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

