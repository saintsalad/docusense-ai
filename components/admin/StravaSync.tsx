"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, RefreshCw, Link2, CheckCircle2, XCircle } from 'lucide-react'

export default function StravaSync() {
    const [isConnected, setIsConnected] = React.useState(false)

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Strava Integration</h2>
                <p className="text-muted-foreground mt-1">
                    Connect and sync your Strava activities
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-orange-500" />
                        Connection Status
                    </CardTitle>
                    <CardDescription>
                        Manage your Strava account connection
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
                                <p className="font-medium">Strava Account</p>
                                <p className="text-sm text-muted-foreground">
                                    {isConnected ? 'Connected and syncing' : 'Not connected'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant={isConnected ? 'outline' : 'default'}
                            onClick={() => setIsConnected(!isConnected)}
                            className="gap-2"
                        >
                            <Link2 className="h-4 w-4" />
                            {isConnected ? 'Disconnect' : 'Connect Account'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isConnected && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activities</CardTitle>
                            <CardDescription>
                                Your latest Strava activities synced to knowledge base
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { name: 'Morning Run', type: 'Run', distance: '5.2 km', time: '2h ago', synced: true, date: '2024-03-15' },
                                    { name: 'Evening Ride', type: 'Ride', distance: '15.8 km', time: '1d ago', synced: true, date: '2024-03-14' },
                                    { name: 'Trail Run', type: 'Run', distance: '8.4 km', time: '2d ago', synced: false, date: '2024-03-13' },
                                ].map((activity, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Activity className="h-5 w-5 text-orange-500" />
                                            <div className="flex-1">
                                                <p className="font-medium">{activity.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {activity.type} • {activity.distance} • {activity.time}
                                                </p>
                                                {activity.synced && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                        ✓ Added to vector DB as strava_{activity.date}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {activity.synced ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sync Settings</CardTitle>
                            <CardDescription>
                                Configure how your Strava data is synced to vector DB
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 p-3 rounded-lg border bg-muted/50">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Auto-sync new activities</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">Enabled</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Include activity notes</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span>Sync frequency</span>
                                    <span className="text-muted-foreground">Every hour</span>
                                </div>
                            </div>

                            <Button className="w-full gap-2" variant="outline">
                                <RefreshCw className="h-4 w-4" />
                                Sync Now
                            </Button>
                            <div className="pt-2 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Last synced: 2 hours ago • 3 activities in vector DB
                                </p>
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

