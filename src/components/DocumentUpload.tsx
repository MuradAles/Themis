import { useState, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, auth, storage } from '../services/firebase';
import './DocumentUpload.css';

interface DocumentUploadProps {
  onClose?: () => void;
}

export default function DocumentUpload({ onClose }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    // Only accept PDF files
    const validFiles = Array.from(selectedFiles).filter((file) => {
      return file.type === 'application/pdf' || file.name.endsWith('.pdf');
    });

    if (validFiles.length < selectedFiles.length) {
      setError('Only PDF files are supported');
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setError('');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };


  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    if (!auth.currentUser) {
      setError('You must be logged in to upload documents');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const userId = auth.currentUser.uid;
      const sourceDocumentIds: string[] = [];

      // Upload each PDF to Storage and save metadata to Firestore
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(((i + 0.5) / files.length) * 100);

        try {
          // Generate unique document ID
          const docId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const storagePath = `documents/${userId}/${docId}.pdf`;
          
          // Upload to Storage
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);

          // Save metadata to Firestore (NO extracted text)
          const sourceDocRef = await addDoc(collection(db, 'sourceDocuments'), {
            name: file.name,
            storagePath: storagePath,
            userId: userId,
            uploadedAt: serverTimestamp(),
            fileSize: file.size,
            mimeType: file.type,
          });

          sourceDocumentIds.push(sourceDocRef.id);
        } catch (err: any) {
          throw new Error(`Failed to upload ${file.name}: ${err.message}`);
        }
      }

      setProgress(100);

      // Close modal if provided
      if (onClose) {
        onClose();
      }
      
      // Refresh the page to show new documents
      window.location.reload();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload documents. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="document-upload-overlay" onClick={onClose}>
      <div className="document-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-header">
          <h2>Upload Documents</h2>
          {onClose && (
            <button className="close-button" onClick={onClose} disabled={uploading}>
              ×
            </button>
          )}
        </div>

        <div
          className="upload-dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="dropzone-content">
            <div className="dropzone-icon">📄</div>
            <p className="dropzone-text">
              Drag and drop files here, or click to select
            </p>
            <p className="dropzone-hint">
              PDF files only
            </p>
            <button
              className="select-files-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {files.length > 0 && (
          <div className="files-list">
            <h3>Selected Files ({files.length})</h3>
            <div className="files-container">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  {!uploading && (
                    <button
                      className="remove-file-button"
                      onClick={() => removeFile(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="progress-text">
              Uploading PDFs... {Math.round(progress)}%
            </p>
          </div>
        )}

        <div className="upload-actions">
          {onClose && (
            <button
              className="cancel-button"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
          )}
          <button
            className="upload-button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? 'Uploading...' : 'Upload PDFs'}
          </button>
        </div>
      </div>
    </div>
  );
}

