import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import './DocumentCard.css';

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    format: string;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    status: 'draft' | 'completed';
  };
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const navigate = useNavigate();

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
      <div className="document-card-header">
        <h3 className="document-title">{document.title || 'Untitled Document'}</h3>
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

