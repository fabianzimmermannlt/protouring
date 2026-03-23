import React, { useState, useEffect, useRef } from 'react';
import { Send, Edit, Trash2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  author: string;
  message: string;
  timestamp: Date;
  userId?: string;
}

interface ChatSectionProps {
  title: string;
  storageKey: string;
  currentUserId: string;
  currentUserName: string;
  showEditButton?: boolean;
  className?: string;
  height?: string;
  placeholder?: string;
  maxMessages?: number;
  isAdmin?: boolean;
  maxMessageLength?: number; // Neu: Zeichenbegrenzung pro Nachricht
}

export function ChatSection({
  title,
  storageKey,
  currentUserId,
  currentUserName,
  showEditButton = true,
  className = "bg-white rounded-lg border p-4 h-[400px] flex flex-col",
  height = "h-[400px]",
  placeholder = "Schreibe eine Nachricht...",
  maxMessages = 50,
  isAdmin = false,
  maxMessageLength = 1200 // Neu: Default 1200 Zeichen
}: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`protouring_${storageKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setMessages(parsed.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })));
    }
  }, [storageKey]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to localStorage
  const saveMessages = (updatedMessages: ChatMessage[]) => {
    localStorage.setItem(`protouring_${storageKey}`, JSON.stringify(updatedMessages));
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    // Zeichenbegrenzung prüfen
    if (newMessage.length > maxMessageLength) {
      alert(`Nachricht zu lang! Maximal ${maxMessageLength} Zeichen erlaubt.`);
      return;
    }

    const newChatMessage: ChatMessage = {
      id: `${Date.now()}_${Math.random()}`,
      author: currentUserName,
      message: newMessage.trim(),
      timestamp: new Date(),
      userId: currentUserId
    };

    const updatedMessages = [...messages, newChatMessage];
    
    // Keep only the last maxMessages messages
    if (updatedMessages.length > maxMessages) {
      updatedMessages.splice(0, updatedMessages.length - maxMessages);
    }

    setMessages(updatedMessages);
    saveMessages(updatedMessages);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([]);
    saveMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Heute';
    } else if (messageDate.toDateString() === new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString()) {
      return 'Gestern';
    } else {
      return messageDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  return (
    <>
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            {messages.length > 0 && isAdmin && (
              <button
                onClick={clearMessages}
                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                title="Alle Nachrichten löschen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {showEditButton && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800 p-1 rounded"
                title="Chat-Einstellungen"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Messages Container */}
        <div className="flex-grow bg-gray-50 rounded-lg p-3 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">Noch keine Nachrichten</p>
              <p className="text-xs mt-1">Sei der Erste, der schreibt!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => {
                const isFirstOfDay = index === 0 || 
                  formatDate(messages[index - 1].timestamp) !== formatDate(message.timestamp);
                
                return (
                  <div key={message.id}>
                    {isFirstOfDay && (
                      <div className="text-center">
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${message.userId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md ${
                        message.userId === currentUserId 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-white border border-gray-200'
                      } rounded-lg px-3 py-2 shadow-sm`}>
                        {/* Immer den Autor anzeigen */}
                        <div className={`font-medium text-xs mb-1 ${
                          message.userId === currentUserId ? 'text-blue-100' : 'text-gray-600'
                        }`}>
                          {message.author}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.message}
                        </div>
                        <div className={`text-xs mt-1 opacity-75 ${
                          message.userId === currentUserId ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            maxLength={maxMessageLength}
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        
        {/* Character Counter */}
        <div className="text-xs text-gray-500 mt-2 text-center">
          {newMessage.length} / {maxMessageLength} Zeichen
        </div>
      </div>

      {/* Edit Modal (placeholder for future settings) */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat-Einstellungen</h3>
            <p className="text-gray-600 mb-4">Chat-Einstellungen werden in zukünftigen Versionen verfügbar.</p>
            <button
              onClick={() => setIsEditing(false)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
