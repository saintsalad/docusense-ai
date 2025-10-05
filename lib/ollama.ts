const embeddingPrompt = `You are given a detailed personal journal entry. Your task is to transform it into JSON chunks optimized for vector embeddings.

Guidelines:

1. Preserve all important details, events, rants, and humorous commentary. Do not drop any key information.
2. Remove unnecessary filler or repetition, but keep personality, tone, and context.
3. Each chunk should be 2-4 sentences long, ideally 25-60 words. Avoid single-sentence chunks unless the event is extremely brief.
4. Keep related ideas, jokes, or examples together in one chunk. Do not split them unnecessarily. 
5. Avoid cramming unrelated events into a single chunk.
6. Return the output as an array of JSON objects in the following format:

[
  { "date": "YYYY-MM-DD", "text": "chunked detail here" },
  { "date": "YYYY-MM-DD", "text": "next chunk" }
]

Input: A multi-paragraph personal journal with events, reflections, and rants.  
Output: A JSON array of concise, context-rich chunks suitable for embeddings, preserving all humor and detail, with proper chunk size and cohesion.`


export async function* chatWithOllamaStream(messages: { role: string; content: string }[]) {
    // Add system message to make AI act as Filipino assistant
    const systemMessage = {
        role: "system",
        content: "You're are a helpful expert AI in software development and always answer in a helpful and informative way"
    };

    const messagesWithSystem = [systemMessage, { role: "user", content: embeddingPrompt }, ...messages];

    const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            //model: "qwen3:8b",
            model: "gpt-oss:20b",
            messages: messagesWithSystem,
            stream: true,
        }),
    });

    if (!res.ok) {
        throw new Error(`Ollama error: ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = ""; // 👈 full growing message

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        accumulated += data.message.content;
                        yield accumulated; // 👈 always yield the full accumulated text
                    }
                    if (data.done) return;
                } catch {
                    continue;
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export async function chatWithOllama(messages: { role: string; content: string }[]) {
    // Add system message to make AI act as Filipino assistant
    const systemMessage = {
        role: "system",
        content: "You are a helpful Filipino AI assistant. You can speak both English and Filipino (Tagalog). You are friendly, knowledgeable, and culturally aware of Filipino customs and traditions. Feel free to use Filipino expressions, greetings, and cultural references when appropriate. Always be respectful and helpful."
    };

    const messagesWithSystem = [systemMessage, ...messages];

    const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama3",
            messages: messagesWithSystem,
            stream: false,
        }),
    });

    if (!res.ok) {
        throw new Error(`Ollama error: ${res.statusText}`);
    }

    return res.json();
}
