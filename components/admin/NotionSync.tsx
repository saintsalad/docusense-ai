"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BookOpen, RefreshCw, Link2, Database, FileText } from 'lucide-react'

interface DatabaseType {
    name: string
    pages: number
    lastSync: string
    status: string
    chunks?: number
}

export default function NotionSync() {
    const [isConnected, setIsConnected] = React.useState(true)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Notion Syncer</h2>
                <p className="text-muted-foreground mt-1">
                    Connect and sync your Notion workspace
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-black dark:text-white" />
                        Connection Status
                    </CardTitle>
                    <CardDescription>
                        Manage your Notion workspace connection
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-3 w-3 rounded-full",
                                isConnected ? "bg-green-500" : "bg-gray-400"
                            )} />
                            <div>
                                <p className="font-medium">Notion Workspace</p>
                                <p className="text-sm text-muted-foreground">
                                    {isConnected ? 'Connected to DocuSense Workspace' : 'Not connected'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={isConnected ? 'outline' : 'default'}
                            onClick={() => setIsConnected(!isConnected)}
                            className="gap-2"
                        >
                            <Link2 className="h-4 w-4" />
                            {isConnected ? 'Disconnect' : 'Connect Workspace'}
                        </Button>
                    </div>

                    {!isConnected && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium">Integration Token</label>
                            <Input
                                type="password"
                                placeholder="secret_xxxxxxxxxxxxxxxxxxxxx"
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Get your integration token from Notion Settings → Integrations
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {isConnected && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Synced Databases</CardTitle>
                            <CardDescription>
                                Notion databases connected to DocuSense
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { name: 'Project Tasks', pages: 24, lastSync: '5 min ago', status: 'synced', chunks: 156 },
                                    { name: 'Meeting Notes', pages: 12, lastSync: '1 hour ago', status: 'synced', chunks: 89 },
                                    { name: 'Documentation', pages: 45, lastSync: '3 hours ago', status: 'syncing', chunks: 0 },
                                ].map((db: DatabaseType, index: number) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-md bg-primary/10">
                                                <Database className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{db.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {db.pages} pages • Last synced {db.lastSync}
                                                </p>
                                                {db.chunks && db.chunks > 0 && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                        {db.chunks} chunks in vector DB
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant={db.status === 'synced' ? 'default' : 'secondary'}>
                                            {db.status === 'synced' ? 'Synced' : 'Syncing...'}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Settings</CardTitle>
                            <CardDescription>
                                Configure how your Notion data is synced
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Auto-sync</p>
                                        <p className="text-xs text-muted-foreground">
                                            Automatically sync changes every hour
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        Enabled
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Manual Sync</p>
                                        <p className="text-xs text-muted-foreground">
                                            Trigger a sync right now
                                        </p>
                                    </div>
                                    <Button variant="default" size="sm" className="gap-2">
                                        <RefreshCw className="h-4 w-4" />
                                        Sync Now
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}

function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}

