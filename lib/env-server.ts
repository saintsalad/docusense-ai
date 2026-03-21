const CHAT_AI_NAME_MAX_LEN = 80;
const CHAT_AI_PERSONALITY_MAX_CHARS = 8_000;

/** Env fallback for assistant display name (`AI_NAME`). */
export function getEnvChatAiName(): string {
    let v = process.env.AI_NAME?.trim() ?? "";
    v = v.replace(/\s+/g, " ");
    if (v.length > CHAT_AI_NAME_MAX_LEN) v = v.slice(0, CHAT_AI_NAME_MAX_LEN).trim();
    return v.length > 0 ? v : "Assistant";
}

/** Env fallback for persona text (`AI_PERSONALITY`). */
export function getEnvChatAiPersonality(): string | undefined {
    const v = process.env.AI_PERSONALITY?.trim();
    if (!v) return undefined;
    if (v.length <= CHAT_AI_PERSONALITY_MAX_CHARS) return v;
    return v.slice(0, CHAT_AI_PERSONALITY_MAX_CHARS);
}

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
