import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/login"
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Quotations from "./pages/Quotations";
import Orders from "./pages/Orders";
import Production from "./pages/Production";
import Inventory from "./pages/Inventory";
import Costing from "./pages/Costing";
import Reports from "./pages/Reports";
import Website from "./pages/Website";
import Administration from "./pages/Administration";
import AdministrationSubmodule from "./pages/AdministrationSubmodule";
import CompanyProfile from "./pages/CompanyProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/quotations" element={<Quotations />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/production" element={<Production />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/costing" element={<Costing />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/website" element={<Website />} />
            <Route path="/administration" element={<Administration />} />
            <Route path="/administration/:tab" element={<AdministrationSubmodule />} />
            <Route path="/administration/company-profile" element={<CompanyProfile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
