/** Server-only flags (never expose secrets to the client). */
export function isServerDebugEnabled(): boolean {
    const v = process.env.DEBUG?.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
}

export function parseChatMaxOutputTokens(): number {
    const raw = process.env.CHAT_MAX_OUTPUT_TOKENS;
    if (raw === undefined || raw === "") return 16_384;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 256) return 16_384;
    return Math.min(n, 128_000);
}
