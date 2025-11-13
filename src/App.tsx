import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DocumentsList from './pages/DocumentsList';
import TemplatesList from './pages/TemplatesList';
import Editor from './pages/Editor';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentsList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Layout>
                <TemplatesList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:documentId?"
          element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/editor/:templateId?"
          element={
            <ProtectedRoute>
              <Editor />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/documents" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
