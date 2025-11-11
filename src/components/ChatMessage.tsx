import { format } from 'date-fns';
import './ChatMessage.css';

interface ChatMessageProps {
  message: string;
  role: 'user' | 'ai';
  timestamp: Date;
}

export default function ChatMessage({ message, role, timestamp }: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message-${role}`}>
      <div className="chat-message-header">
        <span className="chat-message-role">{role === 'user' ? 'You' : 'AI Assistant'}</span>
        <span className="chat-message-time">{format(timestamp, 'HH:mm')}</span>
      </div>
      <div className="chat-message-content">
        {message.split('\n').map((line, index) => (
          <p key={index}>{line || '\u00A0'}</p>
        ))}
      </div>
    </div>
  );
}

