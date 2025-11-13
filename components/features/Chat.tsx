import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../types';
import { createChat } from '../../services/geminiService';
// FIX: Renamed the imported 'Chat' type to 'GeminiChat' to avoid a name collision with the 'Chat' component.
// FIX: Added Content type for chat history.
import type { Chat as GeminiChat, GenerateContentResponse, Content } from '@google/genai';

const CHAT_HISTORY_KEY = 'zenith_chat_history';

const Chat: React.FC = () => {
  // FIX: Use the aliased 'GeminiChat' type for the state.
  const [chat, setChat] = useState<GeminiChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = () => {
      let savedMessages: ChatMessage[] = [];
      let loadedFromStorage = false;
      try {
        const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedMessages = parsed;
            loadedFromStorage = true;
          }
        }
      } catch (e) {
        console.error("Failed to parse chat history from localStorage", e);
        localStorage.removeItem(CHAT_HISTORY_KEY);
      }

      const initialMessages = loadedFromStorage ? savedMessages : [{
        role: 'model',
        content: 'Hello! I am Zenith, your personal AI meditation assistant. How can I help you find your calm today?'
      }];

      const historyForAI = loadedFromStorage
        ? savedMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          }))
        : undefined;
      
      const newChat = createChat(historyForAI);
      setChat(newChat);
      setMessages(initialMessages);
    };
    initChat();
  }, []);

  useEffect(() => {
    // Save messages to local storage whenever they change, if there are any.
    if (messages.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chat || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const stream = await chat.sendMessageStream({ message: input });
      let modelResponse = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      for await (const chunk of stream) {
        modelResponse += chunk.text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = modelResponse;
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      <div className="flex-grow bg-gray-800/50 rounded-t-2xl shadow-2xl p-6 backdrop-blur-md border border-b-0 border-purple-500/30 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-lg p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
               <div className="max-w-lg p-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none flex items-center">
                <div className="w-2 h-2 bg-purple-300 rounded-full animate-pulse mr-2"></div>
                <div className="w-2 h-2 bg-purple-300 rounded-full animate-pulse mr-2 animation-delay-200"></div>
                <div className="w-2 h-2 bg-purple-300 rounded-full animate-pulse animation-delay-400"></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-4 bg-gray-800/80 rounded-b-2xl border border-t-0 border-purple-500/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for meditation advice..."
            className="flex-grow p-3 bg-gray-900/70 border-2 border-gray-600 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-lg"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition transform hover:scale-110 disabled:opacity-50 disabled:scale-100"
          >
            <span className="material-icons">send</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;