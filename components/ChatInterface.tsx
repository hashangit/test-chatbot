// components/ChatInterface.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageRole, ObservationType, LLMMetadata as ArtLLMMetadataType } from 'art-framework'; // Assuming this is your ART Framework import
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, User, Brain, ListChecks, Info, Send, ChevronDown, ChevronUp, MessageSquareText } from 'lucide-react';

// Using Lucide for icons as in user's original code
const SendIconLucide = () => <Send className="h-5 w-5" />;
const BotIconLucide = () => <Bot className="h-[22px] w-[22px]" />;
const UserIconLucide = () => <User className="h-[22px] w-[22px]" />;
const InfoIconLucide = () => <Info className="h-3.5 w-3.5" />;

export interface DisplayMessageData {
    messageId: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    threadId: string;
    isThinking?: boolean;
    thinkingContent?: string;
    observations?: DisplayObservationData[];
    llmMetadata?: ArtLLMMetadataType | null;
    isExtraInfoOpen?: boolean;
}

export interface DisplayObservationData {
    id: string;
    type: ObservationType;
    title: string;
    content: Record<string, unknown> | string | null;
    timestamp: number;
}

interface ChatInterfaceProps {
    messages: DisplayMessageData[];
    onSendMessage: (query: string) => void;
    isLoading: boolean;
    toggleExtraInfo: (messageId: string) => void;
}

// FormattedMetadata to match mock's styling
const FormattedMetadata: React.FC<{ metadata?: ArtLLMMetadataType | null }> = ({ metadata }) => {
    if (!metadata) return null;

    let metadataObject: object;
    // If metadata is already an object (expected for ArtLLMMetadataType)
    if (typeof metadata === 'object' && metadata !== null) {
        metadataObject = metadata;
    } else if (typeof metadata === 'string') { // If it's a string, try to parse
        try {
            metadataObject = JSON.parse(metadata);
        } catch (parseError) {
            console.error("Failed to parse metadata string:", parseError);
            // Fallback for non-JSON or malformed strings
            return <pre className="text-slate-500 font-mono text-[10px] bg-slate-50 p-2 rounded-md overflow-x-auto leading-normal whitespace-pre-wrap custom-scrollbar">{String(metadata)}</pre>;
        }
    } else {
        // Should not happen if ArtLLMMetadataType is well-defined
        return <pre className="text-slate-500 font-mono text-[10px] bg-slate-50 p-2 rounded-md overflow-x-auto leading-normal whitespace-pre-wrap custom-scrollbar">Invalid metadata format</pre>;
    }
    

    return (
        <div className="text-slate-600 font-mono text-[10px] bg-white p-2.5 rounded-md border border-slate-200 shadow-sm overflow-x-auto leading-normal custom-scrollbar">
            {Object.entries(metadataObject).map(([key, value]) => (
                <div key={key} className="flex">
                    <span className="font-semibold text-slate-700 w-1/3 break-words pr-1">{key}:</span>
                    <span className="w-2/3 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
            ))}
        </div>
    );
};

// ExtraInfoSection to match mock's styling
const ExtraInfoSection: React.FC<{
    info: { thoughts?: string; observations?: DisplayObservationData[]; metadata?: ArtLLMMetadataType | null };
    isOpen: boolean;
    onToggle: () => void;
}> = ({ info, isOpen, onToggle }) => (
    <div className="mt-3">
        <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 focus:outline-none transition-colors duration-150 py-1 w-full justify-start rounded-md hover:bg-slate-200/60 px-1"
        >
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{isOpen ? 'Hide Details' : 'Show Details'}</span>
        </button>
        {isOpen && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs shadow-sm space-y-2.5">
                {info.thoughts && (
                    <div>
                        <strong className="font-semibold text-slate-700 text-[11px] flex items-center gap-1 mb-0.5"><Brain className="h-3.5 w-3.5 text-purple-500"/>Agent Thoughts:</strong>
                        <p className="text-slate-600 font-mono text-[11px] leading-snug bg-white p-1.5 rounded border border-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">{info.thoughts}</p>
                    </div>
                )}
                {info.observations && info.observations.length > 0 && (
                     <div>
                        <Separator className="my-1.5 bg-slate-200" />
                        <strong className="font-semibold text-slate-700 text-[11px] flex items-center gap-1 mb-0.5"><ListChecks className="h-3.5 w-3.5 text-green-600"/>Observations:</strong>
                        <ScrollArea className="max-h-40 bg-white p-1.5 rounded border border-slate-200 custom-scrollbar">
                             <ul className="space-y-1.5">
                                {info.observations.map(obs => (
                                    <li key={obs.id} className="text-[11px]">
                                        <Badge variant="secondary" className="mr-1.5 text-[10px] px-1.5 py-0.5 font-normal bg-slate-200 text-slate-700 border-slate-300">{obs.type}</Badge>
                                        <span className="font-medium text-slate-700/90">{obs.title}</span>
                                        <pre className="text-slate-500 font-mono text-[10px] bg-slate-100 p-1 mt-0.5 rounded overflow-x-auto leading-normal whitespace-pre-wrap">{typeof obs.content === 'string' ? obs.content.substring(0,100) : JSON.stringify(obs.content, null, 1).substring(0,100)}...</pre>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
                {info.metadata && (
                    <div>
                        <Separator className="my-1.5 bg-slate-200" />
                        <strong className="font-semibold text-slate-700 text-[11px] flex items-center gap-1 mb-0.5"><InfoIconLucide />LLM Metadata:</strong>
                        <FormattedMetadata metadata={info.metadata} />
                    </div>
                )}
            </div>
        )}
    </div>
);

// MessageBubble to match mock's styling
const MessageBubble: React.FC<{ message: DisplayMessageData; onToggleExtraInfo: (messageId: string) => void; }> = ({ message, onToggleExtraInfo }) => {
    const isUser = message.role === MessageRole.USER;

    return (
      <div className={`flex items-start mb-4 ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
        {!isUser && (
          <Avatar className="flex-shrink-0 mr-2.5 mt-0.5 h-10 w-10 shadow-md ring-2 ring-white">
            <AvatarFallback className="bg-teal-500 text-white"><BotIconLucide /></AvatarFallback>
          </Avatar>
        )}
        <div
          className={`max-w-[70%] md:max-w-[65%] flex flex-col shadow-lg ${
            isUser 
            ? 'rounded-t-2xl rounded-l-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-blue-700 text-white' 
            : 'rounded-t-2xl rounded-r-2xl rounded-bl-md bg-slate-200 text-slate-900 border border-slate-300'
          }`}
        >
            <div className="p-3.5">
                <div
                    className="text-[15px] leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none prose-p:my-1 dark:prose-invert prose-a:text-blue-500 dark:prose-a:text-blue-400"
                    dangerouslySetInnerHTML={{__html: message.content.replace(/\n/g, "<br />")}}
                />
            </div>
             <div className={`text-[11px] mt-0 mb-1.5 px-3.5 ${isUser ? 'text-blue-100 text-right' : 'text-slate-500 text-left'}`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {!isUser && (message.thinkingContent || (message.observations && message.observations.length > 0) || message.llmMetadata) && (
                <div className="px-3.5 pb-2.5"> {/* Wrapper for padding */}
                    <ExtraInfoSection
                        info={{ thoughts: message.thinkingContent, observations: message.observations, metadata: message.llmMetadata }}
                        isOpen={!!message.isExtraInfoOpen}
                        onToggle={() => onToggleExtraInfo(message.messageId)}
                    />
                </div>
            )}
        </div>
        {isUser && (
          <Avatar className="flex-shrink-0 ml-2.5 mt-0.5 h-10 w-10 shadow-md ring-2 ring-white">
            <AvatarFallback className="bg-pink-600 text-white"><UserIconLucide /></AvatarFallback>
          </Avatar>
        )}
      </div>
    );
};

// Main ChatInterface component
const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    onSendMessage,
    isLoading,
    toggleExtraInfo,
}) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            const maxHeight = 128; 
            textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    };

    const handleSendMessageClick = () => {
        if (inputValue.trim() === '') return;
        onSendMessage(inputValue.trim());
        setInputValue('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; 
            textareaRef.current.focus();
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSendMessageClick();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-300 overflow-hidden">
            <header className="bg-slate-800 text-white p-4 flex items-center justify-between shadow-lg sticky top-0 z-20 border-b border-slate-700"> {/* Increased z-index for header */}
                <div className="flex items-center gap-2.5">
                    <MessageSquareText className="h-5 w-5 text-sky-400"/>
                    <h1 className="text-lg font-semibold tracking-wide">Inference Quotient Support</h1>
                </div>
            </header>

            <ScrollArea className="flex-grow bg-white custom-scrollbar">
                <div className="p-4 md:p-5 space-y-1"> 
                    {messages.map((msg) => (
                        <MessageBubble key={msg.messageId} message={msg} onToggleExtraInfo={toggleExtraInfo} />
                    ))}
                    <div ref={messagesEndRef} /> 
                </div>
            </ScrollArea>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-end gap-2 sticky bottom-0 z-20"> {/* Increased z-index for input area */}
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-grow p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-150 text-sm resize-none leading-snug max-h-32 custom-scrollbar bg-white placeholder:text-slate-400"
                    rows={1}
                    disabled={isLoading}
                />
                <Button
                    onClick={handleSendMessageClick}
                    disabled={isLoading || !inputValue.trim()}
                    className="p-3 h-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all duration-150 flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 flex-shrink-0 aspect-square"
                    aria-label="Send message"
                    size="icon" 
                >
                    {isLoading ? (
                         <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <SendIconLucide /> 
                    )}
                </Button>
            </div>
        </div>
    );
};

export default ChatInterface;