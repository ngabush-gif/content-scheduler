import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ContentGenerator from "./pages/ContentGenerator";
import MyContent from "./pages/MyContent";
import ApprovalQueue from "./pages/ApprovalQueue";
import ContentLibrary from "./pages/ContentLibrary";
import ContentCalendar from "./pages/ContentCalendar";
import TeamManagement from "./pages/TeamManagement";
import Publishing from "./pages/Publishing";
import Analytics from "./pages/Analytics";
import PlatformConnections from "./pages/PlatformConnections";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/generate" component={ContentGenerator} />
      <Route path="/my-content" component={MyContent} />
      <Route path="/approval" component={ApprovalQueue} />
      <Route path="/library" component={ContentLibrary} />
      <Route path="/calendar" component={ContentCalendar} />
      <Route path="/team" component={TeamManagement} />
      <Route path="/publish" component={Publishing} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/connections" component={PlatformConnections} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
