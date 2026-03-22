/**
 * Human-friendly chat timestamps: relative when recent, otherwise compact locale string.
 */
export function formatChatTimestamp(ms: number, nowMs: number = Date.now()): string {
    const d = new Date(ms);
    const now = new Date(nowMs);

    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const timeOnly = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(d);

    if (sameDay(d, now)) {
        const diffMin = Math.round((nowMs - ms) / 60_000);
        if (diffMin < 1) return "Just now";
        if (diffMin < 60) return `${diffMin}m ago · ${timeOnly}`;
        return `Today · ${timeOnly}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sameDay(d, yesterday)) {
        return `Yesterday · ${timeOnly}`;
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(d);
}
