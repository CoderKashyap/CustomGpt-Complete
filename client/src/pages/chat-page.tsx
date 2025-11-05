import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, User, Loader2, Bot } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ChatInterface } from "@/components/chat-interface";
import type { Assistant } from "@shared/schema";

export default function ChatPage() {
  const [, params] = useRoute("/chat/:assistantId");
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const assistantId = params?.assistantId;

  const { data: assistant, isLoading } = useQuery<Assistant>({
    queryKey: ["/api/assistants", assistantId],
    enabled: !!assistantId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Assistant Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested assistant could not be found.</p>
          <Button onClick={() => setLocation("/select-assistant")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assistants
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="bg-card border-b border-border px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/select-assistant")}
                data-testid="button-back-to-assistants"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground" data-testid="text-assistant-name">
                    {assistant.name}
                  </h2>
                  <p className="text-sm text-muted-foreground" data-testid="text-assistant-description">
                    {assistant.description || "AI assistant with specialized knowledge"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-muted px-4 py-2 rounded-lg">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium" data-testid="text-username">{user?.username}</span>
                <span className="text-xs text-muted-foreground" data-testid="text-role">({user?.role})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 flex flex-col bg-muted/30">
            <ChatInterface assistantId={assistantId} />
          </div>
        </div>
      </main>
    </div>
  );
}
