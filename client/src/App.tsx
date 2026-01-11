import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import SunnyChat from "@/components/SunnyChat";
import ShopSearch from "@/pages/shop";
import ShopV2Search from "@/pages/shopv2";
import TestDashboard from "@/pages/test";
import VerifyPage from "@/pages/verify";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SunnyChat}/>
      <Route path="/shop" component={ShopSearch}/>
      <Route path="/shopv2" component={ShopV2Search}/>
      <Route path="/docs" component={HomePage}/>
      <Route path="/test" component={TestDashboard}/>
      <Route path="/verify" component={VerifyPage}/>
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
