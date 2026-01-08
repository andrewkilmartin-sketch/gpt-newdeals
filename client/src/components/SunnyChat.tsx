import { useState, useRef, useEffect } from 'react';
import { Sun, Cat, Film, Popcorn, Palette, Ticket, Utensils, LucideIcon } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickPrompt {
  Icon: LucideIcon;
  label: string;
  prompt: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { Icon: Cat, label: 'Safari parks', prompt: 'Safari parks near me' },
  { Icon: Film, label: 'Cinema', prompt: "What's on at the cinema?" },
  { Icon: Popcorn, label: 'Movie night', prompt: 'Family film for tonight on Netflix' },
  { Icon: Palette, label: 'Activities', prompt: 'My kids are bored, what can we do indoors?' },
  { Icon: Ticket, label: 'Theme parks', prompt: 'Theme parks near London' },
  { Icon: Utensils, label: 'Restaurants', prompt: 'Kid-friendly restaurants near me' },
];

export default function SunnyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowWelcome(false);
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/sunny/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
  };

  const formatContent = (content: string) => {
    let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:#F97316;text-decoration:underline;">$1</a>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#FFF7ED', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F97316, #FB923C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sun style={{ width: '32px', height: '32px' }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700' }} data-testid="text-sunny-title">Sunny</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Family Concierge</div>
          </div>
        </div>
        <div style={{ fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px' }}>
          Powered by Kids Pass
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {showWelcome && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px', flex: 1, justifyContent: 'center' }}>
            <Sun style={{ width: '64px', height: '64px', color: '#FB923C', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1F2937', margin: '0 0 12px' }} data-testid="text-welcome-heading">Hey there! I'm Sunny</h2>
            <p style={{ fontSize: '16px', color: '#6B7280', lineHeight: 1.6, maxWidth: '400px', margin: '0 0 32px' }}>
              Your family concierge. I can help you find days out, cinema trips, films to watch at home, activities for the kids - and I'll always find you the best Kids Pass deals!
            </p>
            <div style={{ width: '100%', maxWidth: '500px' }}>
              <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '12px' }}>Try asking me:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {QUICK_PROMPTS.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(item.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
                    data-testid={`button-quick-prompt-${index}`}
                  >
                    <item.Icon style={{ width: '18px', height: '18px', color: '#F97316' }} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }} data-testid={`message-${message.role}-${message.id}`}>
            {message.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sun style={{ width: '18px', height: '18px', color: '#F97316' }} />
              </div>
            )}
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '18px',
                fontSize: '15px',
                lineHeight: 1.5,
                ...(message.role === 'user' 
                  ? { backgroundColor: '#F97316', color: 'white', borderBottomRightRadius: '4px' }
                  : { backgroundColor: 'white', color: '#1F2937', borderBottomLeftRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                )
              }}
              dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
            />
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sun style={{ width: '18px', height: '18px', color: '#F97316' }} />
            </div>
            <div style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '18px', borderBottomLeftRadius: '4px' }}>
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '16px 20px 24px', backgroundColor: 'white', borderTop: '1px solid #E5E7EB' }}>
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about days out, films, activities..."
            disabled={isLoading}
            style={{ flex: 1, padding: '14px 18px', fontSize: '16px', border: '2px solid #E5E7EB', borderRadius: '24px', outline: 'none' }}
            data-testid="input-chat-message"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{ padding: '14px 24px', backgroundColor: '#F97316', color: 'white', border: 'none', borderRadius: '24px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', opacity: isLoading || !input.trim() ? 0.5 : 1 }}
            data-testid="button-send-message"
          >
            Send
          </button>
        </form>
        <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '12px' }}>
          Sunny helps you find family activities with Kids Pass savings
        </p>
      </div>
    </div>
  );
}
