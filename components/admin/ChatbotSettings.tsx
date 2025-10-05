"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Settings, Brain, Zap, Save, RotateCcw } from 'lucide-react'

export default function ChatbotSettings() {
    const [systemPrompt, setSystemPrompt] = useState(
        "You're a helpful expert AI in software development and always answer in a helpful and informative way"
    )
    const [model, setModel] = useState("gpt-oss:20b")
    const [temperature, setTemperature] = useState("0.7")
    const [maxTokens, setMaxTokens] = useState("2000")
    const [enableRAG, setEnableRAG] = useState(true)
    const [ragTopK, setRagTopK] = useState("5")
    const [ragThreshold, setRagThreshold] = useState("0.7")

    const handleSave = () => {
        // In a real implementation, this would save to a config file or database
        console.log('Saving settings:', {
            systemPrompt,
            model,
            temperature,
            maxTokens,
            enableRAG,
            ragTopK,
            ragThreshold
        })
        alert('Settings saved! (Note: This is a demo. In production, this would update your config.)')
    }

    const handleReset = () => {
        setSystemPrompt("You're a helpful expert AI in software development and always answer in a helpful and informative way")
        setModel("gpt-oss:20b")
        setTemperature("0.7")
        setMaxTokens("2000")
        setEnableRAG(true)
        setRagTopK("5")
        setRagThreshold("0.7")
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Chatbot Settings</h2>
                    <p className="text-muted-foreground mt-1">
                        Configure your chatbot's behavior and personality
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button onClick={handleSave} className="gap-2">
                        <Save className="h-4 w-4" />
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Model Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Model Configuration
                    </CardTitle>
                    <CardDescription>
                        Configure which Ollama model to use and its parameters
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Model Name</label>
                        <Input
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g., gpt-oss:20b, llama3, qwen3:8b"
                        />
                        <p className="text-xs text-muted-foreground">
                            Make sure the model is available in your Ollama installation
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Temperature</label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                value={temperature}
                                onChange={(e) => setTemperature(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Controls randomness (0 = focused, 2 = creative)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Max Tokens</label>
                            <Input
                                type="number"
                                step="100"
                                min="100"
                                max="8000"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Maximum response length
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* System Prompt */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        System Prompt
                    </CardTitle>
                    <CardDescription>
                        Define your chatbot's personality and behavior
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        rows={6}
                        className="resize-none font-mono text-sm"
                        placeholder="You are a helpful assistant..."
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        This message is prepended to every conversation to set the AI's behavior
                    </p>
                </CardContent>
            </Card>

            {/* RAG Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        RAG (Retrieval Augmented Generation)
                    </CardTitle>
                    <CardDescription>
                        Configure how the chatbot uses your knowledge base
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium">Enable RAG</p>
                            <p className="text-xs text-muted-foreground">
                                Use vector database for context-aware responses
                            </p>
                        </div>
                        <Button
                            variant={enableRAG ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEnableRAG(!enableRAG)}
                        >
                            {enableRAG ? 'Enabled' : 'Disabled'}
                        </Button>
                    </div>

                    {enableRAG && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Top K Results</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={ragTopK}
                                    onChange={(e) => setRagTopK(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Number of relevant chunks to retrieve from knowledge base
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Similarity Threshold</label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="1"
                                    value={ragThreshold}
                                    onChange={(e) => setRagThreshold(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Minimum similarity score to include results (0 = strict, 1 = lenient)
                                </p>
                            </div>

                            <div className="pt-3 border-t">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline">Preview</Badge>
                                    <span className="text-xs text-muted-foreground">How it works</span>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-md">
                                    <p>1. User asks a question</p>
                                    <p>2. System searches vector DB for top {ragTopK} relevant chunks</p>
                                    <p>3. Chunks above {ragThreshold} similarity are included as context</p>
                                    <p>4. AI generates response using retrieved context + system prompt</p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>
                        Common chatbot management tasks
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-2">
                        <Brain className="h-4 w-4" />
                        Test Chatbot Response
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                        <Zap className="h-4 w-4" />
                        Clear Conversation History
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2">
                        <Settings className="h-4 w-4" />
                        Export Configuration
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

