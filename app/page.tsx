// app/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    createArtInstance,
    ArtInstance,
    AgentProps,
    MessageRole,
    ObservationType,
    LLMMetadata as ArtLLMMetadataType, 
    ExecutionMetadata, 
    ThreadConfig,
    generateUUID,
    StreamEvent as ArtStreamEvent,
    ConversationMessage,
    Observation 
} from 'art-framework'; 
import { artConfig } from '../config/artConfig'; 
import { INFERENCE_QUOTIENT_SYSTEM_PROMPT } from '../config/systemPrompts'; 
import ChatInterface, { DisplayMessageData, DisplayObservationData } from '../components/ChatInterface'; 

const HomePage: React.FC = () => {
    const [art, setArt] = useState<ArtInstance | null>(null);
    const [messages, setMessages] = useState<DisplayMessageData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentThreadId] = useState<string>('iq-support-chat-nextjs-010'); // New ID for fresh start

    const currentAiMessageIdRef = useRef<string | null>(null);
    const accumulatedThinkingContentRef = useRef<string>('');
    const accumulatedObservationsRef = useRef<DisplayObservationData[]>([]);
    const accumulatedLlmMetadataRef = useRef<ArtLLMMetadataType | null>(null);

    useEffect(() => {
        let observationUnsub: (() => void) | null = null;
        let llmStreamUnsub: (() => void) | null = null;

        async function initArt() {
            try {
                console.log("ART: Initializing instance...");
                const instance = await createArtInstance(artConfig);
                setArt(instance);
                console.log("ART: Instance initialized.");

                const threadConfig: ThreadConfig = {
                    providerConfig: {
                        providerName: 'ollama-qwen3-14b', 
                        modelId: 'qwen3:14b-q4_K_M',      
                        adapterOptions: {},
                    },
                    enabledTools: [], 
                    historyLimit: 20,
                };
                await instance.stateManager.setThreadConfig(currentThreadId, threadConfig);
                console.log("ART: Thread config set for:", currentThreadId);

                const history = await instance.conversationManager.getMessages(currentThreadId, { limit: 50 });
                if (history.length === 0) {
                     setMessages([{
                        messageId: generateUUID(),
                        threadId: currentThreadId,
                        role: MessageRole.AI,
                        content: "Hello! I'm the Inference Quotient Support assistant. How can I help you today?",
                        timestamp: Date.now(),
                        isExtraInfoOpen: false,
                    }]);
                } else {
                    setMessages(history.map(msg => ({ ...msg, threadId: msg.threadId || currentThreadId, isExtraInfoOpen: false } as DisplayMessageData)));
                }
                console.log(`ART: Loaded/Initialized ${messages.length} messages.`);
                
                // Corrected subscribe: Only pass onNext callback. Error/completion handling
                // for TypedSocket might be through other framework mechanisms or not directly supported
                // in this specific subscribe signature if the 2nd arg is for filters.
                observationUnsub = instance.uiSystem.getObservationSocket().subscribe(
                    (observation: Observation) => { 
                        if (observation.threadId === currentThreadId && currentAiMessageIdRef.current) {
                            const newDisplayObs: DisplayObservationData = { 
                                id: observation.id, type: observation.type, title: observation.title,
                                content: observation.content, timestamp: observation.timestamp
                            };
                            accumulatedObservationsRef.current = [...accumulatedObservationsRef.current, newDisplayObs];
                            if (observation.type === ObservationType.THOUGHTS && typeof observation.content?.thoughts === 'string') {
                                accumulatedThinkingContentRef.current += (accumulatedThinkingContentRef.current ? '\n---\n' : '') + observation.content.thoughts;
                            }
                            setMessages(prevMsgs => prevMsgs.map(m => {
                                if (m.messageId === currentAiMessageIdRef.current) {
                                    return { 
                                        ...m, 
                                        thinkingContent: accumulatedThinkingContentRef.current,
                                        observations: accumulatedObservationsRef.current,
                                    };
                                }
                                return m;
                            }));
                        }
                    }
                    // No onError or onComplete here to avoid TS2345 if 2nd arg is filter.
                    // If filters are needed, they would go as the second argument.
                    // e.g., ObservationType.THOUGHTS (if that's a valid filter value)
                );

                llmStreamUnsub = instance.uiSystem.getLLMStreamSocket().subscribe(
                    (event: ArtStreamEvent) => { 
                        if (event.threadId === currentThreadId && currentAiMessageIdRef.current) {
                            if (event.type === 'TOKEN') {
                                if (event.tokenType === 'FINAL_SYNTHESIS_LLM_RESPONSE' || event.tokenType === 'LLM_RESPONSE') {
                                    setMessages(prevMsgs => prevMsgs.map(m => {
                                        if (m.messageId === currentAiMessageIdRef.current) {
                                            let currentContent = m.content;
                                            if (currentContent === "Thinking..." || currentContent.endsWith("▍")) {
                                                currentContent = currentContent.endsWith("▍") ? currentContent.slice(0, -1) : "";
                                            }
                                            return { ...m, content: currentContent + event.data + "▍", isThinking: false };
                                        }
                                        return m;
                                    }));
                                }
                            } else if (event.type === 'METADATA') {
                                accumulatedLlmMetadataRef.current = event.data as ArtLLMMetadataType;
                                 setMessages(prevMsgs => prevMsgs.map(m => {
                                    if (m.messageId === currentAiMessageIdRef.current) {
                                        return { ...m, llmMetadata: accumulatedLlmMetadataRef.current };
                                    }
                                    return m;
                                }));
                            } else if (event.type === 'END') {
                                setMessages(prevMsgs => prevMsgs.map(m => {
                                    if (m.messageId === currentAiMessageIdRef.current) {
                                        return {
                                            ...m,
                                            content: m.content.endsWith("▍") ? m.content.slice(0, -1) : m.content,
                                            isThinking: false,
                                            thinkingContent: accumulatedThinkingContentRef.current,
                                            observations: accumulatedObservationsRef.current,
                                            llmMetadata: accumulatedLlmMetadataRef.current,
                                        };
                                    }
                                    return m;
                                }));
                                currentAiMessageIdRef.current = null;
                                accumulatedThinkingContentRef.current = '';
                                accumulatedObservationsRef.current = [];
                                accumulatedLlmMetadataRef.current = null;
                            } else if (event.type === 'ERROR') {
                                console.error("ART: LLM Stream Error from socket:", event.data);
                                const errorMsg = (event.data instanceof Error) ? event.data.message : String(event.data);
                                if(currentAiMessageIdRef.current) {
                                    setMessages(prevMsgs => prevMsgs.map(m =>
                                        m.messageId === currentAiMessageIdRef.current
                                            ? { ...m, content: `Stream Error: ${errorMsg}`, isThinking: false }
                                            : m
                                    ));
                                    currentAiMessageIdRef.current = null;
                                }
                            }
                        }
                    }
                    // No onError or onComplete here for LLMStreamSocket subscribe
                );
                console.log("ART: Subscribed to observation and LLM stream sockets.");
            } catch (e: unknown) { 
                console.error("ART: Failed to initialize ART:", e);
                const errorMessage = e instanceof Error ? e.message : String(e);
                setMessages([{
                    messageId: generateUUID(),
                    threadId: currentThreadId,
                    role: MessageRole.AI,
                    content: `Error: Could not initialize the chat service. Details: ${errorMessage}`,
                    timestamp: Date.now(),
                    isExtraInfoOpen: false,
                }]);
            }
        }
        initArt();
        return () => { 
            if (observationUnsub) observationUnsub();
            if (llmStreamUnsub) llmStreamUnsub();
            console.log("ART: Cleaned up ART subscriptions.");
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentThreadId]); 

    const toggleExtraInfo = (messageId: string) => {
        setMessages(prevMessages =>
            prevMessages.map(msg =>
                msg.messageId === messageId ? { ...msg, isExtraInfoOpen: !msg.isExtraInfoOpen } : msg
            )
        );
    };

    const handleSendMessage = useCallback(async (query: string) => {
        if (!art || isLoading) { 
            console.warn("ART: Attempted to send message but ART not initialized or already loading.");
            return; 
        }
        setIsLoading(true);
        accumulatedThinkingContentRef.current = '';
        accumulatedObservationsRef.current = [];
        accumulatedLlmMetadataRef.current = null;

        const userMessage: DisplayMessageData = {
            messageId: generateUUID(),
            threadId: currentThreadId,
            role: MessageRole.USER,
            content: query,
            timestamp: Date.now(),
            isExtraInfoOpen: false,
        };
        setMessages(prev => [...prev, userMessage]);

        const newAiMessageId = generateUUID();
        currentAiMessageIdRef.current = newAiMessageId;

        const tempAiMessage: DisplayMessageData = {
            messageId: newAiMessageId,
            threadId: currentThreadId,
            role: MessageRole.AI,
            content: "Thinking...", 
            timestamp: Date.now(),
            isThinking: true,
            isExtraInfoOpen: false,
        };
        setMessages(prev => [...prev, tempAiMessage]);

        const agentProps: AgentProps = {
            query,
            threadId: currentThreadId,
            userId: "web-user-nextjs-iq", 
            options: {
                providerConfig: { 
                    providerName: 'ollama-qwen3-14b', 
                    modelId: 'qwen3:14b-q4_K_M',      
                    adapterOptions: {},
                },
                stream: true, 
                systemPrompt: INFERENCE_QUOTIENT_SYSTEM_PROMPT
            }
        };

        try {
            console.log("ART: Calling art.process() with props:", agentProps);
            const finalResponse = await art.process(agentProps); 
            
            console.log("ART: Agent process finished. Final response object:", finalResponse);

            if (currentAiMessageIdRef.current) { 
                 setMessages(prevMsgs => prevMsgs.map(m => {
                    if (m.messageId === currentAiMessageIdRef.current) {
                        let finalContentFromResponse = "Response processing had an issue.";
                        if (typeof finalResponse.response === 'string') {
                            finalContentFromResponse = finalResponse.response;
                        } else if (typeof finalResponse.response === 'object' && finalResponse.response && 'content' in finalResponse.response) {
                            finalContentFromResponse = (finalResponse.response as ConversationMessage).content;
                        }
                        
                        let currentContent = m.content;
                        if (currentContent === "Thinking..." || currentContent.endsWith("▍")) {
                           currentContent = currentContent.endsWith("▍") ? currentContent.slice(0, -1) : finalContentFromResponse;
                           if (currentContent.endsWith("▍")) { 
                               currentContent = currentContent.slice(0,-1);
                           }
                        }
                        
                        const finalMetadata = finalResponse.metadata as ArtLLMMetadataType | ExecutionMetadata;

                        return {
                            ...m,
                            content: currentContent,
                            isThinking: false,
                            thinkingContent: accumulatedThinkingContentRef.current,
                            observations: accumulatedObservationsRef.current,
                            llmMetadata: accumulatedLlmMetadataRef.current || (finalMetadata as ArtLLMMetadataType), 
                        };
                    }
                    return m;
                }));
                currentAiMessageIdRef.current = null; 
            }


        } catch (e: unknown) { 
            console.error("ART: Error calling art.process():", e);
            const errorMsg = (e instanceof Error) ? e.message : String(e);
            if (currentAiMessageIdRef.current) {
                setMessages(prevMsgs => prevMsgs.map(m =>
                    m.messageId === currentAiMessageIdRef.current
                        ? { ...m, content: `Error during processing: ${errorMsg}`, isThinking: false }
                        : m
                ));
                currentAiMessageIdRef.current = null;
            } else { 
                 setMessages(prev => [...prev, {
                    messageId: generateUUID(),
                    threadId: currentThreadId,
                    role: MessageRole.AI,
                    content: `System Error: ${errorMsg}`,
                    timestamp: Date.now(),
                    isExtraInfoOpen: false,
                }]);
            }
        } finally {
            setIsLoading(false);
            if (currentAiMessageIdRef.current) { 
                console.warn("ART: Forcing cleanup of AI message in finally block.");
                 setMessages(prevMsgs => prevMsgs.map(m => {
                    if (m.messageId === currentAiMessageIdRef.current && m.isThinking) { 
                        return {
                            ...m,
                            content: m.content.endsWith("▍") ? m.content.slice(0, -1) : (m.content === "Thinking..." ? "Response processing incomplete." : m.content),
                            isThinking: false,
                            thinkingContent: accumulatedThinkingContentRef.current,
                            observations: accumulatedObservationsRef.current,
                            llmMetadata: accumulatedLlmMetadataRef.current,
                        };
                    }
                    return m;
                }));
                currentAiMessageIdRef.current = null;
            }
            accumulatedThinkingContentRef.current = '';
            accumulatedObservationsRef.current = [];
            accumulatedLlmMetadataRef.current = null;
        }
    }, [art, isLoading, currentThreadId]);

    return (
        <main className="flex flex-col items-center justify-center w-screen h-screen p-2 sm:p-4 bg-slate-100 font-sans antialiased">
            <div className="w-full max-w-lg h-full sm:max-h-[calc(100vh-40px)] sm:my-5 flex flex-col">
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    toggleExtraInfo={toggleExtraInfo}
                />
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: var(--scrollbar-track); 
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--scrollbar-thumb); 
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--scrollbar-thumb-hover); 
                }
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
                }
                .prose p {
                    margin-top: 0.5em;
                    margin-bottom: 0.5em;
                }
            `}</style>
        </main>
    );
};

export default HomePage;
