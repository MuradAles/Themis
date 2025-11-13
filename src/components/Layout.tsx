import { type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleCreateNew = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      // Determine if we're on templates or documents page
      const isTemplatesPage = location.pathname.startsWith('/templates');
      
      if (isTemplatesPage) {
        // Create empty template
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
<p>[Describe the relevant facts of the case]</p>

<p><strong>Legal Basis:</strong></p>
<p>[Explain the legal basis for the demand]</p>

<p><strong>Demand:</strong></p>
<p>[State the specific demand or action required]</p>

<p>Please respond within [Number] days. Failure to respond may result in legal action.</p>

<p>Sincerely,</p>
<p>[Your Name]</p>
<p>[Your Title]</p>`;

        const docRef = await addDoc(collection(db, 'templates'), {
          name: '',
          content: defaultTemplateContent,
          isSystemDefault: false,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        navigate(`/templates/editor/${docRef.id}`);
      } else {
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

        navigate(`/editor/${docRef.id}`);
      }
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Failed to create item. Please try again.');
    }
  };

  const handleUploadNew = () => {
    // This will be handled by the specific page component
    // We'll use a custom event or context for this
    const isTemplatesPage = location.pathname.startsWith('/templates');
    if (isTemplatesPage) {
      // Trigger upload modal on templates page
      window.dispatchEvent(new CustomEvent('openTemplateUpload'));
    } else {
      // Trigger upload modal on documents page
      window.dispatchEvent(new CustomEvent('openDocumentUpload'));
    }
  };

  // Only show sidebar on documents and templates pages
  const showSidebar = location.pathname.startsWith('/documents') || 
                      location.pathname.startsWith('/templates');

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="page-with-sidebar">
      <Sidebar onCreateNew={handleCreateNew} onUploadNew={handleUploadNew} showToggle={true} />
      {children}
    </div>
  );
}

