"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    LayoutDashboard,
    Database,
    Upload,
    Activity,
    BookOpen,
    Menu,
    X,
    Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const menuItems = [
    { id: 'knowledge', label: 'Knowledge Base', icon: Database, href: '/admin' },
    { id: 'upload', label: 'File Uploader', icon: Upload, href: '/admin/upload' },
    { id: 'strava', label: 'Strava Sync', icon: Activity, href: '/admin/strava' },
    { id: 'notion', label: 'Notion Sync', icon: BookOpen, href: '/admin/notion' },
    { id: 'settings', label: 'Chatbot Settings', icon: Settings, href: '/admin/settings' },
]

export default function AdminSidebar() {
    const [isExpanded, setIsExpanded] = useState(true)
    const pathname = usePathname()

    return (
        <motion.aside
            initial={{ width: 240 }}
            animate={{ width: isExpanded ? 240 : 64 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="relative h-screen border-r bg-card/50 backdrop-blur-sm"
        >
            <div className="flex h-16 items-center justify-between border-b px-4">
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2"
                    >
                        <LayoutDashboard className="h-6 w-6 text-primary" />
                        <span className="font-semibold text-lg">DocuSense</span>
                    </motion.div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-9 w-9"
                >
                    {isExpanded ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
            </div>

            <nav className="space-y-2 p-3">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link key={item.id} href={item.href}>
                            <Button
                                variant={isActive ? 'default' : 'ghost'}
                                className={cn(
                                    'w-full justify-start gap-3 transition-all',
                                    !isExpanded && 'justify-center px-2'
                                )}
                            >
                                <Icon className="h-5 w-5 shrink-0" />
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: 0.05 }}
                                        className="text-sm font-medium"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </Button>
                        </Link>
                    )
                })}
            </nav>
        </motion.aside>
    )
}

