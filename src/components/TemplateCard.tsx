import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import './TemplateCard.css';

interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    content: string;
    isSystemDefault: boolean;
    userId: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
  };
}

export default function TemplateCard({ template }: TemplateCardProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleClick = () => {
    if (!showMenu) {
      navigate(`/templates/editor/${template.id}`);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowMenu(!showMenu);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowMenu(false);

    if (template.isSystemDefault) {
      return; // Don't delete system default templates
    }

    try {
      await deleteDoc(doc(db, 'templates', template.id));
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const doc = window.document;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.template-menu-container')) {
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

  const formattedDate = format(getDate(template.updatedAt || template.createdAt), 'MMM d, yyyy');

  return (
    <div className="template-card" onClick={handleClick}>
      {/* Template Preview */}
      {template.content && (
        <div className="template-preview">
          <div 
            className="template-preview-content"
            dangerouslySetInnerHTML={{ __html: template.content }}
          />
        </div>
      )}
      {!template.content && (
        <div className="template-preview-empty">
          <span className="preview-empty-text">No content yet</span>
        </div>
      )}
      
      {!template.isSystemDefault && (
        <div className="template-menu-container">
          <button 
            className="template-menu-button"
            onClick={handleMenuClick}
            title="Menu"
          >
            <span className="menu-dots">⋯</span>
          </button>
          {showMenu && (
            <div className="template-menu-dropdown">
              <button 
                className="template-menu-item delete-item"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
      <div className="template-card-header">
        <div className="template-title-row">
          <h3 className="template-title">{template.name}</h3>
          {template.isSystemDefault && (
            <span className="default-badge">Default</span>
          )}
          {!template.isSystemDefault && (
            <span className="template-date">{formattedDate}</span>
          )}
        </div>
      </div>
      {template.isSystemDefault && (
        <div className="template-card-body">
          <div className="template-meta">
            <span className="template-date">{formattedDate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

