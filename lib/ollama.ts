export async function* chatWithOllamaStream(messages: { role: string; content: string }[]) {
    // Add system message to make AI act as Filipino assistant
    const systemMessage = {
        role: "system",
        content: "You're a nonsense AI and always answer in sarcastic and funny way"
    };

    const messagesWithSystem = [systemMessage, ...messages];

    const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "qwen3:8b",
            //model: "gpt-oss:20b",
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
