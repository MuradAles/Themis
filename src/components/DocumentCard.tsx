import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import './DocumentCard.css';

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    format: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    status: 'draft' | 'completed';
    content?: string | null;
  };
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const navigate = useNavigate();
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load document content for preview
  useEffect(() => {
    // If content is already provided, use it
    if (document.content !== undefined) {
      setPreviewContent(document.content);
      return;
    }

    // Otherwise, fetch it
    const loadPreview = async () => {
      if (!document.id) return;
      
      setLoadingPreview(true);
      try {
        const docRef = doc(db, 'documents', document.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPreviewContent(data.content || null);
        }
      } catch (error) {
        console.error('Error loading preview:', error);
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, [document.id, document.content]);

  const handleClick = () => {
    navigate(`/editor/${document.id}`);
  };

  // Convert Firestore Timestamp to Date
  const getDate = (timestamp: any) => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) {
      return timestamp.toDate();
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date(timestamp);
  };

  const formattedDate = format(getDate(document.updatedAt || document.createdAt), 'MMM d, yyyy');
  const statusBadge = document.status === 'completed' ? 'Completed' : 'Draft';

  return (
    <div className="document-card" onClick={handleClick}>
      {/* Document Preview */}
      {previewContent && (
        <div className="document-preview">
          <div 
            className="document-preview-content"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        </div>
      )}
      {!previewContent && !loadingPreview && (
        <div className="document-preview-empty">
          <span className="preview-empty-text">No content yet</span>
        </div>
      )}
      {loadingPreview && (
        <div className="document-preview-loading">
          <span className="preview-loading-text">Loading preview...</span>
        </div>
      )}
      
      <div className="document-card-header">
        <h3 className="document-title">{document.title || '(No title)'}</h3>
        <span className={`status-badge status-${document.status}`}>{statusBadge}</span>
      </div>
      <div className="document-card-body">
        <div className="document-meta">
          <span className="document-format">{document.format || 'Standard'}</span>
          <span className="document-date">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

