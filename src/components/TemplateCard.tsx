import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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

  const handleClick = () => {
    navigate(`/templates/editor/${template.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    if (template.isSystemDefault) {
      alert('Cannot delete system default template');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'templates', template.id));
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
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
      
      <div className="template-card-header">
        <h3 className="template-title">{template.name}</h3>
        {template.isSystemDefault && (
          <span className="default-badge">Default</span>
        )}
      </div>
      <div className="template-card-body">
        <div className="template-meta">
          <span className="template-date">{formattedDate}</span>
          {!template.isSystemDefault && (
            <button 
              className="delete-button"
              onClick={handleDelete}
              title="Delete template"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

