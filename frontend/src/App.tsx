import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DocumentNew from "./pages/DocumentNew";
import DocumentDetail from "./pages/DocumentDetail";
import DocumentList from "./pages/DocumentList";
import Holerites from "./pages/Holerites";
import SignPage from "./pages/SignPage";
import Settings from "./pages/Settings";
import Templates from "./pages/Templates";
import VerifyDocument from "./pages/VerifyDocument";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import DpaPage from "./pages/DpaPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sign/:token" element={<SignPage />} />
      <Route path="/verify/:code" element={<VerifyDocument />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/dpa" element={<DpaPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/documents" element={<DocumentList />} />
                <Route path="/documents/new" element={<DocumentNew />} />
                <Route path="/documents/:id" element={<DocumentDetail />} />
                <Route path="/holerites" element={<Holerites />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/templates" element={<Templates />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
