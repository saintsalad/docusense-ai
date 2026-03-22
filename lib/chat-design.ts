/**
 * Centralized chat UI design tokens.
 *
 * Palette: neutral zinc base, primary accent only on interactive elements.
 * AI = indigo tones. User = foreground (near-black in light, near-white in dark).
 * No background gradients; shadows used very sparingly.
 *
 * Font scale: base 15px for body/bubble text; scaled accordingly for meta/label.
 */

export const chatLayout = {
    virtualThreshold: 28,
    virtualOverscan: 8,
    virtualEstimateRowPx: 180,
    virtualGapPx: 0,
    virtualPaddingStartPx: 24,
    virtualPaddingEndPx: 32,
    stickToBottomPx: 120,
    sidebarPreviewMaxChars: 45,
    kbContextPreviewMaxChars: 6000,
    /** avatar diameter (px) + gap (px) = meta-row indent  8 + 12 = 44 → pl-11 */
    avatarPx: 36,
    gapPx: 12,
} as const;

/* ─── Shell ─────────────────────────────────────────────────────────────── */

export const chatShell = {
    root: "flex h-screen overflow-hidden bg-background",
    chatRegion: "flex min-w-0 flex-1 flex-col bg-background",
    messagesScroll: "min-h-0 flex-1 overflow-y-auto scroll-smooth",
    messagesInner: "mx-auto w-full max-w-2xl px-4 pb-10 pt-6 sm:px-5",
    /** Mobile-only top bar */
    mobileHeader:
        "flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 md:hidden",
    mobileMenuBtn:
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    mobileTitleText: "min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground",
    mobileNewChatBtn:
        "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
} as const;

/* ─── Sidebar ────────────────────────────────────────────────────────────── */

export const chatSidebar = {
    /**
     * On mobile: fixed overlay, slides in/out.
     * On md+: back in normal document flow (relative, auto z-index, always visible).
     */
    aside:
        "fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-border bg-background transition-transform duration-200 ease-in-out md:relative md:inset-auto md:z-auto md:translate-x-0",
    asideOpen: "translate-x-0",
    asideClosed: "-translate-x-full",
    /** Scrim behind sidebar on mobile */
    backdrop:
        "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden",
    header:
        "flex items-center justify-between gap-2 border-b border-border px-4 py-3.5",
    headerLeft: "flex min-w-0 flex-1 items-center gap-2",
    title: "text-[15px] font-semibold text-foreground",
    titleIcon: "size-5 shrink-0 text-muted-foreground",
    /** X close button — mobile only */
    closeBtn:
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden",
    newChatBtn:
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40",
    scrollArea: "min-h-0 flex-1 py-2",
    list: "space-y-px px-2",
    convBtn:
        "group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
    convBtnActive: "bg-muted/70",
    convBtnInactive: "",
    convIconWrap:
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors",
    convIconWrapActive: "border-primary/20 bg-primary/10 text-primary",
    convIconWrapInactive: "text-muted-foreground",
    convBody: "min-w-0 flex-1",
    convTitle: "truncate text-[14px] font-medium leading-tight text-foreground",
    convMeta: "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground",
    convMetaDot: "size-1 shrink-0 rounded-full bg-muted-foreground/40",
    /** New-chat agent picker dropdown */
    newChatPickerWrap:
        "absolute right-0 top-full z-30 mt-1.5 w-60 rounded-xl border border-border bg-background py-1.5 shadow-lg",
    newChatPickerLabel:
        "px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
    newChatPickerItem:
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
    /** Inline agent label shown beneath each conversation title in the list */
    convAgentLabel:
        "inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground/80",
} as const;

/* ─── Composer ───────────────────────────────────────────────────────────── */

export const chatComposer = {
    bar: "shrink-0 border-t border-border bg-background/95 backdrop-blur-sm",
    inner: "mx-auto flex max-w-2xl items-end gap-2 px-4 py-3.5 sm:px-5",
    textarea:
        "min-h-[52px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] placeholder:text-muted-foreground transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
    sendBtn:
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-40",
} as const;

/* ─── Message rows ───────────────────────────────────────────────────────── */

export const chatMessage = {
    outerAssistant: "mb-6 flex flex-col items-start gap-1.5",
    outerUser: "mb-6 flex flex-col items-end gap-1.5",
    /**
     * Meta row indented to clear the circular avatar.
     * avatar 36px + gap 12px = 48px → pl-12 / pr-12
     */
    metaAssistant: "flex items-center gap-1.5 pl-12 text-xs text-muted-foreground",
    metaUser: "flex items-center gap-1.5 text-xs text-muted-foreground",
    /** Bubble row: avatar + bubble, both starting at the top */
    bubbleRowAssistant: "flex w-full items-start gap-3",
    bubbleRowUser: "flex w-full flex-row-reverse items-start gap-3",
    /** Circular avatar */
    avatarBase:
        "flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] leading-none",
    avatarAssistant:
        "border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-400",
    metaName: "text-[12px] font-medium text-foreground/70",
} as const;

/* ─── Bubbles ────────────────────────────────────────────────────────────── */

export const chatBubble = {
    base: "rounded-lg px-4 py-2.5 text-[15px] leading-relaxed",
    user: "w-fit max-w-[min(100%,28rem)] bg-foreground text-background",
    assistant:
        "w-fit max-w-[min(100%,40rem)] border border-border bg-card text-card-foreground shadow-xs",
    userText: "whitespace-pre-wrap wrap-break-word",
} as const;

/* ─── System / status ────────────────────────────────────────────────────── */

export const chatSystem = {
    emptyWrap:
        "flex min-h-[min(50vh,28rem)] flex-col items-center justify-center gap-4 px-6 text-center",
    emptyIconWrap:
        "flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground",
    emptyTitle: "text-[17px] font-semibold text-foreground",
    emptySubtitle: "max-w-xs text-[15px] leading-relaxed text-muted-foreground",
    errorCard:
        "mx-auto mt-3 w-[calc(100%-2rem)] max-w-2xl shrink-0 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[15px] text-destructive sm:w-[calc(100%-2.5rem)]",
    debugWrap: "mx-auto w-full max-w-2xl shrink-0 px-4 pt-3 sm:px-5",
    debugTrigger:
        "flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40",
    debugContent: "pt-1.5",
    debugCard: "rounded-lg border border-border bg-card shadow-none",
    debugCardHeader: "px-3 py-2",
    debugCardTitle: "text-[13px] font-medium text-foreground",
    debugLabel: "text-muted-foreground",
    debugMono: "font-mono text-xs text-foreground",
    debugPre:
        "mt-1 max-h-24 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground",
} as const;

/* ─── Typing indicator ───────────────────────────────────────────────────── */

export const chatTyping = {
    row: "flex min-h-[22px] items-center gap-2 text-muted-foreground",
    icon: "size-4 shrink-0 animate-spin",
    text: "text-[15px]",
} as const;

/* ─── Copy ───────────────────────────────────────────────────────────────── */

export const chatCopy = {
    sidebarHeading: "Chats",
    newChatAria: "New chat",
    inputPlaceholder: "Message… (Shift+Enter for new line)",
    emptyTitle: "Ask anything",
    emptySubtitle: "Relevant context from your knowledge base is retrieved automatically.",
    newConversationPreview: "New chat",
    roleUser: "You",
    defaultAiName: "Assistant",
} as const;
