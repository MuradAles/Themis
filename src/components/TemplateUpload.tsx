import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, storage, db, functions } from '../services/firebase';
import './TemplateUpload.css';

interface TemplateUploadProps {
  onClose: () => void;
}

export default function TemplateUpload({ onClose }: TemplateUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!auth.currentUser) {
      setError('You must be logged in to upload templates');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const userId = auth.currentUser.uid;
      setProgress(20);

      // Generate unique ID for PDF
      const docId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storagePath = `templates/${userId}/${docId}.pdf`;
      
      // Upload PDF to Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      setProgress(40);

      // Call analyzeTemplateFromPDF function
      const analyzeTemplate = httpsCallable(functions, 'analyzeTemplateFromPDF');
      const result = await analyzeTemplate({
        storagePath,
        fileName: file.name,
      });
      setProgress(80);

      const data = result.data as { templateHTML: string };

      // Get author name from user
      const authorName = auth.currentUser.displayName || auth.currentUser.email || 'Unknown';
      
      // Create template document with AI-generated HTML
      const templateRef = await addDoc(collection(db, 'templates'), {
        name: file.name.replace('.pdf', ''),
        content: data.templateHTML,
        isSystemDefault: false,
        userId: userId,
        authorName: authorName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setProgress(100);

      // Close modal and navigate to template editor
      onClose();
      navigate(`/templates/editor/${templateRef.id}`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload and analyze PDF. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="template-upload-overlay" onClick={onClose}>
      <div className="template-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-upload-header">
          <h2>Upload PDF Template</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="template-upload-body">
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {!file ? (
              <>
                <div className="drop-zone-icon">📄</div>
                <p className="drop-zone-text">Drag and drop a PDF here</p>
                <p className="drop-zone-subtext">or click to browse</p>
              </>
            ) : (
              <>
                <div className="drop-zone-icon">✓</div>
                <p className="drop-zone-text">{file.name}</p>
                <p className="drop-zone-subtext">Click to change file</p>
              </>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {uploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="progress-text">
                {progress < 40 ? 'Uploading PDF...' :
                 progress < 80 ? 'Analyzing template structure...' :
                 'Creating template...'}
              </p>
            </div>
          )}
        </div>

        <div className="template-upload-footer">
          <button className="cancel-button" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button 
            className="upload-submit-button" 
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Analyzing...' : 'Upload & Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

