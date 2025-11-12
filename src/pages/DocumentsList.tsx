import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
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

  const handleCreateNew = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      // Create empty document
      const docRef = await addDoc(collection(db, 'documents'), {
        title: '',
        content: null,
        format: 'Standard',
        status: 'draft',
        userId: auth.currentUser.uid,
        sourceDocumentIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Navigate to editor with new document
      navigate(`/editor/${docRef.id}`);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document. Please try again.');
    }
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
          <button onClick={handleCreateNew} className="create-button">
            + Create New
          </button>
          <button onClick={handleUploadNew} className="upload-button">
            + Upload PDF
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
          <p>Get started by creating a new document or uploading a PDF</p>
          <div className="empty-state-actions">
            <button onClick={handleCreateNew} className="create-button">
              + Create New Document
            </button>
          <button onClick={handleUploadNew} className="upload-button">
              + Upload PDF
          </button>
          </div>
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

