import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, FileText, LogOut, User, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Assistant } from "@shared/schema";

export default function SelectAssistant() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const { data: assistants, isLoading } = useQuery<Assistant[]>({
    queryKey: ["/api/my-assistants"],
  });

  const handleSelectAssistant = (assistantId: string) => {
    setLocation(`/chat/${assistantId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <header className="bg-card border-b border-border px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Assistants</h1>
              <p className="text-xs text-muted-foreground">Select an assistant to chat</p>
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

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Select an AI Assistant</h2>
          <p className="text-muted-foreground">
            Choose an assistant to start a conversation. Each assistant has specialized knowledge.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : assistants && assistants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assistants.map((assistant) => (
              <Card 
                key={assistant.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                data-testid={`card-assistant-${assistant.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Bot className="w-7 h-7 text-primary" />
                    </div>
                    {assistant.isActive && (
                      <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl" data-testid={`text-assistant-name-${assistant.id}`}>
                    {assistant.name}
                  </CardTitle>
                  <CardDescription data-testid={`text-assistant-description-${assistant.id}`}>
                    {assistant.description || "AI assistant with specialized knowledge"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 mr-1" />
                      <span>Knowledge base available</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSelectAssistant(assistant.id)}
                    className="w-full"
                    data-testid={`button-select-assistant-${assistant.id}`}
                  >
                    Start Chat
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted/50">
            <CardContent className="py-12 text-center">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Assistants Available</h3>
              <p className="text-muted-foreground">
                You don't have access to any AI assistants yet. Please contact your administrator to grant access.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
