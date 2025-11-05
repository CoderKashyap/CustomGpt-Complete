import { Sidebar } from "@/components/sidebar";
import { VectorStoreStatus } from "@/components/vector-store-status";
import { UploadSection } from "@/components/upload-section";
import { ChatInterface } from "@/components/chat-interface";
import { Plus, Activity, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="bg-card border-b border-border px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">AI Assistant Platform</h2>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Manage AI assistants and knowledge bases" : "Chat with AI assistants"}
              </p>
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
          {isAdmin ? (
            <>
              <div className="w-1/2 border-r border-border overflow-y-auto p-8">
                <div className="mb-8">
                  <VectorStoreStatus />
                </div>
                
                <div className="mb-8">
                  <UploadSection />
                </div>
                
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Activity className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Getting Started</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Create AI assistants, upload knowledge base documents, and test them with the chat interface.
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Go to AI Assistants page to create and manage your custom assistants with specialized knowledge.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="w-1/2 flex flex-col bg-muted/30">
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Admin Test Panel - Testing assistants in isolated sessions
                    </p>
                  </div>
                </div>
                <ChatInterface isTestMode={true} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col bg-muted/30">
              <ChatInterface />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
