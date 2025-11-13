import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, or, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import TemplateCard from '../components/TemplateCard';
import TemplateUpload from '../components/TemplateUpload';
import './TemplatesList.css';

interface Template {
  id: string;
  name: string;
  content: string;
  isSystemDefault: boolean;
  userId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export default function TemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([]);
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
    const templatesRef = collection(db, 'templates');
    
    // Query for templates: user's own templates OR system default templates
    const q = query(
      templatesRef,
      or(
        where('userId', '==', userId),
        where('isSystemDefault', '==', true)
      ),
      orderBy('isSystemDefault', 'desc'), // System default first
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const temps: Template[] = [];
        snapshot.forEach((doc) => {
          temps.push({
            id: doc.id,
            ...doc.data(),
          } as Template);
        });
        setTemplates(temps);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Error fetching templates:', err);
        setError('Failed to load templates. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [navigate]);

  const handleUploadPDF = () => {
    setShowUpload(true);
  };

  const handleCreateNew = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      // Create empty template with default structure
      const defaultTemplateContent = `<p><strong>[Law Firm Name]</strong></p>
<p>[Law Firm Address]</p>
<p>[City, State ZIP]</p>
<p>[Phone Number]</p>
<p>[Email]</p>

<p>[Date]</p>

<p><strong>[Recipient Name]</strong></p>
<p>[Recipient Title]</p>
<p>[Recipient Company]</p>
<p>[Recipient Address]</p>

<p>Dear [Recipient Name],</p>

<p>This letter serves as a formal demand regarding [Case Subject].</p>

<p><strong>Facts:</strong></p>
<p>[Case Facts]</p>

<p><strong>Demand:</strong></p>
<p>[Demand Details]</p>

<p>Please respond by [Deadline Date].</p>

<p>Sincerely,</p>
<p>[Attorney Name]</p>`;

      const templateRef = await addDoc(collection(db, 'templates'), {
        name: 'New Template',
        content: defaultTemplateContent,
        isSystemDefault: false,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Navigate to template editor with new template
      navigate(`/templates/editor/${templateRef.id}`);
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="templates-list-container">
        <div className="loading-state">Loading templates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="templates-list-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="templates-list-container">
      <header className="templates-header">
        <h1 className="templates-title">My Templates</h1>
        <div className="header-actions">
          <button onClick={handleCreateNew} className="create-button">
            + Create New Template
          </button>
          <button onClick={handleUploadPDF} className="upload-button">
            + Upload PDF
          </button>
          <button onClick={() => navigate('/documents')} className="back-button">
            ← Back to Documents
          </button>
        </div>
      </header>

      {templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h2>No templates yet</h2>
          <p>Get started by creating a new template or uploading a PDF</p>
          <div className="empty-state-actions">
            <button onClick={handleCreateNew} className="create-button">
              + Create New Template
            </button>
            <button onClick={handleUploadPDF} className="upload-button">
              + Upload PDF
            </button>
          </div>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {showUpload && (
        <TemplateUpload onClose={() => setShowUpload(false)} />
      )}
    </div>
  );
}

