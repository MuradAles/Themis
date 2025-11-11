import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import DocumentCard from '../components/DocumentCard';
import DocumentUpload from '../components/DocumentUpload';
import './DocumentsList.css';

interface Document {
  id: string;
  title: string;
  format: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  status: 'draft' | 'completed';
}

export default function DocumentsList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    const userId = auth.currentUser.uid;
    const documentsRef = collection(db, 'documents');
    const q = query(
      documentsRef,
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Document[] = [];
        snapshot.forEach((doc) => {
          docs.push({
            id: doc.id,
            ...doc.data(),
          } as Document);
        });
        setDocuments(docs);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleUploadNew = () => {
    setShowUpload(true);
  };

  if (loading) {
    return (
      <div className="documents-list-container">
        <div className="loading-state">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="documents-list-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="documents-list-container">
      <header className="documents-header">
        <h1 className="documents-title">My Documents</h1>
        <div className="header-actions">
          <button onClick={handleUploadNew} className="upload-button">
            + Upload New
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h2>No documents yet</h2>
          <p>Get started by uploading your first document</p>
          <button onClick={handleUploadNew} className="upload-button">
            + Upload New Document
          </button>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      )}

      {showUpload && (
        <DocumentUpload onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}

