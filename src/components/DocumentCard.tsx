import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
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
  const [showMenu, setShowMenu] = useState(false);

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
    if (!showMenu) {
      navigate(`/editor/${document.id}`);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowMenu(!showMenu);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowMenu(false);

    try {
      await deleteDoc(doc(db, 'documents', document.id));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const doc = window.document;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.document-menu-container')) {
        setShowMenu(false);
      }
    };

    // Use setTimeout to avoid immediate closure when opening menu
    setTimeout(() => {
      doc.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      doc.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

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
      
      <div className="document-menu-container">
        <button 
          className="document-menu-button"
          onClick={handleMenuClick}
          title="Menu"
        >
          <span className="menu-dots">⋯</span>
        </button>
        {showMenu && (
          <div className="document-menu-dropdown">
            <button 
              className="document-menu-item delete-item"
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="document-card-header">
        <div className="document-title-row">
          <h3 className="document-title">{document.title || '(No title)'}</h3>
          <span className="document-date">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

