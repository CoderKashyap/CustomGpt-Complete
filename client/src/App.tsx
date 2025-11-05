import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import AdminSignupPage from "@/pages/admin-signup-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AssistantsPage from "@/pages/assistants-page";
import SelectAssistant from "@/pages/select-assistant";
import ChatPage from "@/pages/chat-page";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin-signup" component={AdminSignupPage} />
      <Route path="/admin-dashboard">
        {() => <ProtectedRoute component={AdminDashboard} />}
      </Route>
      <Route path="/assistants">
        {() => <ProtectedRoute component={AssistantsPage} />}
      </Route>
      <Route path="/select-assistant">
        {() => <ProtectedRoute component={SelectAssistant} />}
      </Route>
      <Route path="/chat/:assistantId">
        {() => <ProtectedRoute component={ChatPage} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
