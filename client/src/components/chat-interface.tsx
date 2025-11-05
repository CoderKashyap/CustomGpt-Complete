import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ChatMessage, ChatSession, Assistant } from "@shared/schema";
import { Bot, User, Send, Trash2, Download, Plus, MessageSquare, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";



export function ChatMessageBox({ msg, role = "assistant" }: { msg: ChatMessage; role?: string }) {
  const isAssistant = role === "assistant";

  // Clean up lines starting with "*" that aren't actual lists
  const cleanedContent = msg.content
    .split("\n")
    .map((line: string) => {
      // Detect lines that start with "* " but not followed by another "*"
      if (/^\*\s+[^*]/.test(line.trim())) {
        return line.replace(/^\*\s+/, "• "); // replace with bullet dot for visual style
      }
      return line;
    })
    .join("\n");

  return (
    <div
      className={`flex w-full my-3 ${isAssistant ? "justify-start" : "justify-end"
        }`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed
        ${isAssistant
            ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "bg-blue-600 text-white"
          }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside space-y-1 mb-2" {...props} />
            ),
            li: ({ node, ...props }) => <li className="ml-4" {...props} />,
            strong: ({ node, ...props }) => (
              <strong className="font-semibold" {...props} />
            ),
            code: ({ node, ...props }: any) =>
              props.inline ? (
                <code
                  className="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5"
                  {...props}
                />
              ) : (
                <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded-md overflow-x-auto text-sm my-2">
                  <code {...props} />
                </pre>
              ),
          }}
        >
          {cleanedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}





export function ChatInterface({ assistantId, isTestMode = false }: { assistantId?: string; isTestMode?: boolean }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(assistantId || null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load ALL assistants for admin test mode, or user's accessible assistants otherwise
  const { data: availableAssistants } = useQuery<Assistant[]>({
    queryKey: isTestMode ? ["/api/assistants"] : ["/api/my-assistants"],
  });
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Load sessions - filter by selected assistantId and isTest if provided
  const sessionsQuery = new URLSearchParams();
  if (selectedAssistantId) sessionsQuery.append("assistantId", selectedAssistantId);
  if (isTestMode) sessionsQuery.append("isTest", "1");
  const sessionsQueryString = sessionsQuery.toString();
  
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["/api/sessions", sessionsQueryString],
    queryFn: async () => {
      const url = `/api/sessions${sessionsQueryString ? `?${sessionsQueryString}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sessions");
      return response.json();
    },
  });

  // Auto-select first session
  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [sessions, currentSessionId]);

  // Reset session when assistant changes in test mode
  useEffect(() => {
    if (isTestMode && selectedAssistantId !== assistantId) {
      setCurrentSessionId(null);
    }
  }, [selectedAssistantId, isTestMode, assistantId]);

  // Load messages for current session
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/sessions", currentSessionId, "messages"],
    enabled: !!currentSessionId,
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (title: string = "New Conversation") => {
      const res = await apiRequest("POST", "/api/sessions", { 
        title, 
        assistantId: selectedAssistantId,
        isTest: isTestMode ? 1 : 0
      });
      return await res.json();
    },
    onSuccess: (newSession: ChatSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setCurrentSessionId(newSession.id);
      toast({
        title: "Success",
        description: "New conversation created",
      });
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/sessions/${sessionId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });

      // Auto-select the next available session or create a new one
      const remainingSessions = sessions.filter(s => s.id !== currentSessionId);
      if (remainingSessions.length > 0) {
        setCurrentSessionId(remainingSessions[0].id);
      } else {
        // No sessions left, create a new one
        createSessionMutation.mutate("New Conversation");
      }

      toast({
        title: "Success",
        description: "Conversation deleted",
      });
    },
  });

  // Clear current session messages
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!currentSessionId) throw new Error("No active session");
      const res = await fetch(`/api/sessions/${currentSessionId}/messages`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear messages");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", currentSessionId, "messages"] });
      toast({
        title: "Success",
        description: "Chat history cleared",
      });
    },
  });

  const sendMessage = async () => {
    if (!message.trim() || isStreaming || !currentSessionId) return;

    const userMessage = message.trim();
    setMessage("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }

      // Check if the response is JSON or streaming
      const contentType = res.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        // Handle non-streaming JSON response
        const data = await res.json();
        
        // Show the response briefly (optional - for better UX)
        if (data.content) {
          setStreamingMessage(data.content);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Invalidate cache to refetch messages
        setIsStreaming(false);
        setStreamingMessage("");
        await queryClient.invalidateQueries({ queryKey: ["/api/sessions", currentSessionId, "messages"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      } else {
        // Handle streaming response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No reader available");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setIsStreaming(false);
                setStreamingMessage("");
                queryClient.invalidateQueries({ queryKey: ["/api/sessions", currentSessionId, "messages"] });
                queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
                break;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  setStreamingMessage((prev) => prev + parsed.content);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " minutes ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hours ago";
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [message]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (format: string) => {
    if (!currentSessionId) return;

    const url = `/api/sessions/${currentSessionId}/export?format=${format}`;
    window.open(url, '_blank');
    setShowExportMenu(false);

    toast({
      title: "Export Started",
      description: `Downloading conversation as ${format.toUpperCase()}`,
    });
  };

  const allMessages = [...messages];
  if (isStreaming && streamingMessage) {
    allMessages.push({
      id: "streaming",
      sessionId: currentSessionId!,
      role: "assistant",
      content: streamingMessage,
      citations: null,
      timestamp: new Date(),
    });
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{currentSession?.title || "AI Analysis Assistant"}</h3>
              <p className="text-xs text-muted-foreground">Powered by GPT-5 with File Search</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isTestMode && availableAssistants && availableAssistants.length > 0 && (
              <Select value={selectedAssistantId || undefined} onValueChange={(value) => setSelectedAssistantId(value || null)}>
                <SelectTrigger className="w-[240px]" data-testid="assistant-selector">
                  <SelectValue placeholder="Select AI Assistant to Test" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssistants.map((assistant) => (
                    <SelectItem key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors"
              onClick={() => createSessionMutation.mutate("New Conversation")}
              disabled={createSessionMutation.isPending}
              data-testid="button-new-session"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              New Chat
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending || !currentSessionId}
              data-testid="button-clear-chat"
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              Clear Chat
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors flex items-center"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!currentSessionId}
                data-testid="button-export"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-lg shadow-lg z-10">
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors rounded-t-lg"
                    onClick={() => handleExport('json')}
                    data-testid="export-json"
                  >
                    JSON
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => handleExport('markdown')}
                    data-testid="export-markdown"
                  >
                    Markdown
                  </button>
                  <button
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors rounded-b-lg"
                    onClick={() => handleExport('text')}
                    data-testid="export-text"
                  >
                    Text
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Tabs */}
        {sessions.length > 0 && (
          <div className="flex items-center space-x-2 mt-3 overflow-x-auto pb-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center space-x-2 ${currentSessionId === session.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                data-testid={`session-tab-${session.id}`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>{session.title}</span>
                {sessions.length > 1 && currentSessionId === session.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSessionMutation.mutate(session.id);
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="chat-messages">
        {!currentSessionId ? (
          <div className="chat-message flex items-start space-x-3">
            <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <div className="bg-card rounded-xl rounded-tl-none p-4 shadow-sm border border-border">
                <p className="text-sm text-foreground">
                  Welcome! Create a new conversation to get started.
                </p>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="chat-message flex items-start space-x-3">
                <div className="w-8 h-8 bg-muted rounded-lg animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-20 bg-muted rounded-xl animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : allMessages.length === 0 ? (
          <div className="chat-message flex items-start space-x-3">
            <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <div className="bg-card rounded-xl rounded-tl-none p-4 shadow-sm border border-border">
                <p className="text-sm text-foreground">
                  Welcome! I'm ready to assist you. I have access to the knowledge base documents that have been uploaded.
                  <br /><br />
                  Ask me anything related to the documents, and I'll provide detailed answers with citations.
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-2">Just now</p>
            </div>
          </div>
        ) : (
          allMessages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`chat-message flex items-start space-x-3 ${msg.role === "user" ? "justify-end" : ""}`}
              data-testid={`message-${idx}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-secondary" />
                </div>
              )}

              {/* <div className={`flex-1 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                <div className={msg.role === "user" ? "max-w-[80%]" : "flex-1"}>
                  <div 
                    className={`rounded-xl p-4 shadow-sm ${
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border border-border rounded-tl-none"
                    }`}
                  >



                    <p className="text-sm whitespace-pre-wrap" data-testid="text-message-content">
                      {msg.content}
                    </p>





                  </div>
                  <p className={`text-xs text-muted-foreground mt-1 ${msg.role === "user" ? "text-right mr-2" : "ml-2"}`}>
                    {msg.id === "streaming" ? "Now" : formatTimestamp(msg.timestamp)}
                  </p>
                </div>
              </div> */}


              <ChatMessageBox msg={msg} role={msg.role} />

              {msg.role === "user" && (
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
            </div>
          ))
        )}

        {isStreaming && !streamingMessage && (
          <div className="chat-message flex items-start space-x-3">
            <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <div className="bg-card rounded-xl rounded-tl-none p-4 shadow-sm border border-border inline-block">
                <div className="typing-indicator flex space-x-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-card border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2 bg-muted/30 rounded-xl border border-input p-1">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={currentSessionId ? 'Type your message to ask questions...' : 'Create a new conversation to start chatting...'}
              className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || !currentSessionId}
              data-testid="input-message"
            />
            <button
              type="submit"
              className="w-10 h-10 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              disabled={!message.trim() || isStreaming || !currentSessionId}
              data-testid="button-send"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer hover:text-foreground transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded border-input" defaultChecked />
                <span>Stream Response</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer hover:text-foreground transition-colors">
                <input type="checkbox" className="w-4 h-4 rounded border-input" defaultChecked />
                <span>Show Citations</span>
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span>End-to-end encrypted</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
