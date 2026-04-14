'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, MessageSquare, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hello! I am your ThubPay AI assistant. I can help you analyze your revenue, manage invoices, or troubleshoot payment disputes. How can I help you today?" 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/dashboard/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error('Failed to fetch AI response');

      const data = await response.json();
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-thubpay-gold text-[#111] shadow-2xl shadow-thubpay-gold/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border border-white/20"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[350px] sm:w-[450px] h-[600px] max-h-[80vh] bg-thubpay-obsidian border border-thubpay-border rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col glass-card animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-thubpay-border flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-thubpay-gold/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-thubpay-gold" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">AI Insight Engine</h3>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1 inline-block">Active • GLM 4.7 Flash Free</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-zinc-500 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-thubpay-gold/10 text-thubpay-gold border border-thubpay-gold/20 shadow-lg shadow-thubpay-gold/5' 
                : 'bg-thubpay-elevated text-zinc-300 border border-thubpay-border shadow-md'
            }`}>
              <div className="flex items-center gap-2 mb-1.5 opacity-60">
                {msg.role === 'user' ? (
                  <User className="w-3 h-3" />
                ) : (
                  <Bot className="w-3 h-3 text-thubpay-gold" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {msg.role === 'user' ? 'YOU' : 'THUBPAY ASSISTANT'}
                </span>
              </div>
              <div className="prose prose-invert prose-xs max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-thubpay-elevated border border-thubpay-border p-4 rounded-2xl text-sm text-zinc-400 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-thubpay-gold" />
              <span>Analyzing patterns...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-thubpay-border bg-white/5">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            placeholder="Ask about your revenue..."
            className="w-full bg-thubpay-obsidian border border-thubpay-border rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-colors disabled:opacity-50"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 w-8 h-8 rounded-lg bg-thubpay-gold text-[#111] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 text-center mt-3 font-medium uppercase tracking-tighter">
          Powered by ThubPay AI • Financial Intelligence Advisor
        </p>
      </div>
    </div>
  );
}
