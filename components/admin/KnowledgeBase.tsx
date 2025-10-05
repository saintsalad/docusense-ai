"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Database, Search, Trash2, RefreshCw, Filter, FileText, Activity, BookOpen, Edit } from 'lucide-react'
import { defaultEmbeddingFunction } from '@/lib/chroma'


interface CollectionInfo {
    name: string
    count: number
    vectorDimension: number
    avgEmbeddingSize: string
    storageUsed: string
}

interface VectorStats {
    status: string
    version: string
    totalCollections: number
    totalVectors: number
    totalStorage: string
    collections: CollectionInfo[]
}

interface Embedding {
    id: string
    content: string
    type: 'custom' | 'journal' | 'strava' | 'notion'
    createdAt: string
    chunks?: number
    metadata?: {
        source?: string
        title?: string
        author?: string
        category?: string
        page?: number
        date?: string
        model?: string
        [key: string]: unknown
    }
}

export default function KnowledgeBase() {
    const [stats, setStats] = useState<VectorStats | null>(null)
    const [embeddings, setEmbeddings] = useState<Embedding[]>([])
    const [filteredEmbeddings, setFilteredEmbeddings] = useState<Embedding[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        filterEmbeddings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [embeddings, filterType, searchQuery])

    const fetchData = async () => {
        setIsLoading(true)
        try {
            // Fetch stats
            const statsRes = await fetch('/api/chroma/info')
            const statsData = await statsRes.json()
            setStats(statsData)

            // Fetch all records
            const recordsRes = await fetch('/api/chroma/list?limit=1000')
            const recordsData = await recordsRes.json()

            if (recordsData.success && recordsData.records) {
                setEmbeddings(recordsData.records)
            } else {
                console.error('Failed to fetch records:', recordsData.error)
                setEmbeddings([])
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
            setEmbeddings([])
        } finally {
            setIsLoading(false)
        }
    }

    const filterEmbeddings = () => {
        let filtered = embeddings

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(e => e.type === filterType)
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(e =>
                e.id.toLowerCase().includes(query) ||
                e.content.toLowerCase().includes(query)
            )
        }

        setFilteredEmbeddings(filtered)
    }


    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'custom':
                return <FileText className="h-4 w-4" />
            case 'journal':
                return <Edit className="h-4 w-4" />
            case 'strava':
                return <Activity className="h-4 w-4" />
            case 'notion':
                return <BookOpen className="h-4 w-4" />
            default:
                return <FileText className="h-4 w-4" />
        }
    }

    const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
        switch (type) {
            case 'journal':
                return 'default'
            case 'strava':
                return 'secondary'
            case 'notion':
                return 'outline'
            default:
                return 'secondary'
        }
    }

    const getTypeStats = () => {
        return {
            all: embeddings.length,
            custom: embeddings.filter(e => e.type === 'custom').length,
            journal: embeddings.filter(e => e.type === 'journal').length,
            strava: embeddings.filter(e => e.type === 'strava').length,
            notion: embeddings.filter(e => e.type === 'notion').length,
        }
    }

    const typeStats = getTypeStats()

    const handleDelete = async (id: string) => {
        if (!confirm(`Are you sure you want to delete record "${id}"?`)) {
            return
        }

        try {
            const response = await fetch(`/api/chroma/delete?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
            })

            const data = await response.json()

            if (data.success) {
                // Remove from local state
                setEmbeddings(prev => prev.filter(e => e.id !== id))
            } else {
                alert(`Failed to delete: ${data.error}`)
            }
        } catch (error) {
            console.error('Delete error:', error)
            alert('Failed to delete record')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Knowledge Base</h2>
                    <p className="text-muted-foreground mt-1">
                        Manage your chatbot&apos;s vector database embeddings
                    </p>
                </div>
                <Button onClick={fetchData} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeStats.all}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            All embeddings
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-accent/50" onClick={() => setFilterType('custom')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Custom</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeStats.custom}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Custom text
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-accent/50" onClick={() => setFilterType('journal')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Journal</CardTitle>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeStats.journal}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Journal entries
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-accent/50" onClick={() => setFilterType('strava')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Strava</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeStats.strava}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Activities
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-accent/50" onClick={() => setFilterType('notion')}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Notion</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {typeStats.notion}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Notion pages
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Embeddings Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>All Embeddings</CardTitle>
                            <CardDescription>
                                Browse and manage all stored embeddings in your vector database
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by ID or content..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={filterType === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterType('all')}
                                className="gap-2"
                            >
                                <Filter className="h-4 w-4" />
                                All ({typeStats.all})
                            </Button>
                            <Button
                                variant={filterType === 'custom' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterType('custom')}
                            >
                                Custom ({typeStats.custom})
                            </Button>
                            <Button
                                variant={filterType === 'journal' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterType('journal')}
                            >
                                Journal ({typeStats.journal})
                            </Button>
                            <Button
                                variant={filterType === 'strava' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterType('strava')}
                            >
                                Strava ({typeStats.strava})
                            </Button>
                            <Button
                                variant={filterType === 'notion' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterType('notion')}
                            >
                                Notion ({typeStats.notion})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading embeddings...</p>
                        </div>
                    ) : filteredEmbeddings.length === 0 ? (
                        <div className="text-center py-12">
                            <Database className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground">
                                {searchQuery || filterType !== 'all'
                                    ? 'No embeddings found matching your filters'
                                    : 'No embeddings in database yet'}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">ID</TableHead>
                                    <TableHead>Content</TableHead>
                                    <TableHead className="w-[100px]">Type</TableHead>
                                    <TableHead className="w-[150px]">Created</TableHead>
                                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEmbeddings.map((embedding) => (
                                    <TableRow key={embedding.id}>
                                        <TableCell className="font-mono text-xs">
                                            <div className="truncate max-w-[160px]" title={embedding.id}>
                                                {embedding.id}
                                            </div>
                                            {(embedding.metadata?.source || embedding.metadata?.title) && (
                                                <div className="text-xs text-muted-foreground mt-1 truncate max-w-[160px]"
                                                    title={embedding.metadata?.source || embedding.metadata?.title}>
                                                    {embedding.metadata?.source || embedding.metadata?.title}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-2xl">
                                            <div
                                                className="text-sm line-clamp-3 cursor-help"
                                                title={embedding.content}
                                            >
                                                {embedding.content}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={getTypeBadgeVariant(embedding.type)}
                                                className="gap-1"
                                            >
                                                {getTypeIcon(embedding.type)}
                                                {embedding.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDate(embedding.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(embedding.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Database Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Database Information</CardTitle>
                    <CardDescription>
                        Vector database configuration and stats
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Status</span>
                                <Badge variant="default">{stats?.status || 'Unknown'}</Badge>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Version</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.version || 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Total Collections</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.totalCollections || 0}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium">Total Vectors</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.totalVectors || 0}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Storage Used</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.totalStorage || '0 KB'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Embedding Model</span>
                                <span className="text-sm text-muted-foreground">
                                    {defaultEmbeddingFunction.name}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm font-medium">Vector Dimension</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.collections?.[0]?.vectorDimension || 0}D
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium">Avg. Embedding Size</span>
                                <span className="text-sm text-muted-foreground">
                                    {stats?.collections?.[0]?.avgEmbeddingSize || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

