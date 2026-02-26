import { useEffect, useState, useRef } from 'react';
import { Send, Terminal } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender: 'user' | 'wanda';
    text: string;
}

export default function App() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        ws.current = new WebSocket('ws://localhost:8080');

        ws.current.onopen = () => {
            console.log('Connected to Wanda WebSocket');
        };

        ws.current.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                setMessages(prev => [...prev, { id: msg.id, sender: 'wanda', text: msg.text }]);
            } catch (e) {
                console.error('Failed to parse message', e);
            }
        };

        return () => {
            ws.current?.close();
        };
    }, []);

    const handleSend = () => {
        if (!input.trim() || !ws.current) return;

        const text = input.trim();
        // Optimistic UI update
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);

        // Send to Wanda Backend
        ws.current.send(JSON.stringify({ text, userId: 'web-user' }));
        setInput('');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', margin: '0 auto', border: '1px solid #1e293b' }}>
            <header style={{ padding: '1rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={24} color="#818cf8" />
                <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>Wanda Visual Interface</h1>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((m) => (
                    <div key={m.id} style={{
                        alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                        backgroundColor: m.sender === 'user' ? '#3b82f6' : '#1e293b',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        maxWidth: '80%',
                        lineHeight: '1.5'
                    }}>
                        {m.text}
                    </div>
                ))}
            </main>

            <footer style={{ padding: '1rem', borderTop: '1px solid #1e293b', display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Message Wanda..."
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', outline: 'none' }}
                />
                <button
                    onClick={handleSend}
                    style={{ padding: '0.75rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Send size={20} />
                </button>
            </footer>
        </div>
    );
}
