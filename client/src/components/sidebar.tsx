import { Brain, Home, Database, MessageSquare, BarChart3, Settings, User, LogOut, Shield, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export function Sidebar() {
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  
  const isActive = (path: string) => location === path;
  
  return (
    <aside className="w-64 sidebar-gradient text-white flex flex-col shadow-2xl">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Assistants</h1>
            <p className="text-xs text-white/70">Knowledge Platform</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link 
          href="/dashboard" 
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
            isActive("/dashboard") || isActive("/")
              ? "bg-white/20"
              : "hover:bg-white/10"
          } transition-colors`}
          data-testid="nav-dashboard"
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </Link>
        
        {isAdmin && (
          <>
            <Link 
              href="/admin-dashboard" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
                isActive("/admin-dashboard")
                  ? "bg-white/20"
                  : "hover:bg-white/10"
              } transition-colors`}
              data-testid="nav-admin-dashboard"
            >
              <Shield className="w-5 h-5" />
              <span>Admin Dashboard</span>
            </Link>
            
            <Link 
              href="/assistants" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
                isActive("/assistants")
                  ? "bg-white/20"
                  : "hover:bg-white/10"
              } transition-colors`}
              data-testid="nav-assistants"
            >
              <Bot className="w-5 h-5" />
              <span>AI Assistants</span>
            </Link>
          </>
        )}
      </nav>
      
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3 px-4 py-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">John Smith</p>
            <p className="text-xs text-white/70">Admin</p>
          </div>
          <button 
            className="text-white/70 hover:text-white transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
