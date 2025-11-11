import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DocumentsList from './pages/DocumentsList';
import Editor from './pages/Editor';
import ProtectedRoute from './components/ProtectedRoute';
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
              <DocumentsList />
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
        <Route path="/" element={<Navigate to="/documents" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
