'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, User, Bot, Trash2 } from 'lucide-react'

export interface Message {
  id: string
  text: string
  sender: string
  timestamp: Date
  type: 'user' | 'system' | 'admin'
}

export interface CommunicationProps {
  title?: string
  placeholder?: string
  storageKey?: string
  maxHeight?: string
  showHeader?: boolean
  enableInput?: boolean
  onSendMessage?: (message: Message) => void
  className?: string
  userName?: string
  userRole?: string
}

export function Communication({
  title = 'Kommunikation',
  placeholder = 'Nachricht eingeben...',
  storageKey,
  maxHeight = 'h-[400px]',
  showHeader = true,
  enableInput = true,
  onSendMessage,
  className = '',
  userName = 'User',
  userRole = 'user'
}: CommunicationProps) {
  console.log('Communication Props - userRole:', userRole)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    console.log('=== Communication Mount ===')
    console.log('storageKey:', storageKey)
    if (storageKey && typeof window !== 'undefined') {
      const savedMessages = localStorage.getItem(storageKey)
      console.log('localStorage.getItem result:', savedMessages)
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages)
          console.log('Parsed messages:', parsed)
          setMessages(parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })))
        } catch (error) {
          console.error('Error loading messages:', error)
        }
      } else {
        console.log('No saved messages found')
      }
      setIsLoaded(true)
    }
  }, [storageKey])

  // Save messages to localStorage when they change (but not on initial load)
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined' && isLoaded) {
      console.log('=== Saving messages ===')
      console.log('storageKey:', storageKey)
      console.log('messages:', messages)
      localStorage.setItem(storageKey, JSON.stringify(messages))
      console.log('Saved to localStorage')
    }
  }, [messages, storageKey, isLoaded])

  // Auto-scroll to bottom when new messages arrive (but only scroll within the chat container)
  useEffect(() => {
    if (messagesEndRef.current && messagesEndRef.current.parentElement) {
      messagesEndRef.current.parentElement.scrollTop = messagesEndRef.current.parentElement.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: userName,
      timestamp: new Date(),
      type: 'user'
    }

    setIsLoading(true)
    
    try {
      // Add user message
      setMessages(prev => [...prev, newMessage])
      setInputText('')

      // Call callback if provided
      if (onSendMessage) {
        await onSendMessage(newMessage)
      }

      setIsLoading(false)

    } catch (error) {
      console.error('Error sending message:', error)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleDeleteChat = () => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
      setMessages([])
      setShowDeleteConfirm(false)
    }
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('de-DE', { 
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    })
  }

  const getSenderIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4" />
      case 'admin':
        return <MessageCircle className="w-4 h-4" />
      default:
        return <Bot className="w-4 h-4" />
    }
  }

  const getSenderColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-500'
      case 'admin':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`bg-white flex flex-col ${maxHeight} ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between p-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <div className="text-sm">Noch keine Nachrichten</div>
            <div className="text-xs mt-1">Starte die Konversation</div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-2 ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.type !== 'user' && (
                <div className={`w-8 h-8 rounded-full ${getSenderColor(message.type)} flex items-center justify-center text-white flex-shrink-0`}>
                  {getSenderIcon(message.type)}
                </div>
              )}
              
              <div className={`max-w-xs lg:max-w-md ${
                message.type === 'user' ? 'order-2' : 'order-1'
              }`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.type === 'admin'
                      ? 'bg-green-100 text-green-900 border border-green-200'
                      : 'bg-gray-100 text-gray-900 border border-gray-200'
                  }`}
                >
                  {message.text}
                </div>
                <div className={`text-xs text-gray-500 mt-1 ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  {message.sender} • {formatDateTime(message.timestamp)}
                </div>
              </div>

              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0 order-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-start space-x-2 justify-start">
            <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-100 text-gray-900 border border-gray-200 px-3 py-2 rounded-lg text-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {enableInput && (
        <div className="border-t p-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Communication
