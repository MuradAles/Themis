import { useState, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import './DocumentUpload.css';

// Configure PDF.js worker - use jsdelivr CDN with correct path
// For pdfjs-dist v5, use the .mjs worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs`;

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

    const validFiles = Array.from(selectedFiles).filter((file) => {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ];
      return validTypes.includes(file.type) || file.name.endsWith('.pdf') || 
             file.name.endsWith('.docx') || file.name.endsWith('.doc') || 
             file.name.endsWith('.txt');
    });

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

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        text += pageText + '\n\n';
      }

      return text.trim();
    } catch (err) {
      throw new Error(`Failed to extract text from PDF: ${err}`);
    }
  };

  const extractTextFromWord = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (err) {
      throw new Error(`Failed to extract text from Word document: ${err}`);
    }
  };

  const extractTextFromText = async (file: File): Promise<string> => {
    try {
      return await file.text();
    } catch (err) {
      throw new Error(`Failed to read text file: ${err}`);
    }
  };

  const extractText = async (file: File): Promise<string> => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      return await extractTextFromPDF(file);
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc')
    ) {
      return await extractTextFromWord(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await extractTextFromText(file);
    } else {
      throw new Error('Unsupported file type');
    }
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

      // Extract text from each file and save to sourceDocuments
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(((i + 0.5) / files.length) * 100);

        try {
          const extractedText = await extractText(file);

          // Save to sourceDocuments collection
          const sourceDocRef = await addDoc(collection(db, 'sourceDocuments'), {
            name: file.name,
            extractedText: extractedText,
            uploadedAt: serverTimestamp(),
            userId: userId,
            documentId: '', // Will be set after document creation
          });

          sourceDocumentIds.push(sourceDocRef.id);
        } catch (err: any) {
          throw new Error(`Failed to process ${file.name}: ${err.message}`);
        }
      }

      setProgress(90);

      // Create document entry in Firestore
      const documentRef = await addDoc(collection(db, 'documents'), {
        title: files.length === 1 
          ? files[0].name.replace(/\.[^/.]+$/, '') // Remove extension
          : `Document ${new Date().toLocaleDateString()}`,
        content: null, // Will be generated later
        format: 'Standard',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: userId,
        sourceDocumentIds: sourceDocumentIds,
        status: 'draft',
      });

      // Update sourceDocuments with documentId
      const { updateDoc, doc } = await import('firebase/firestore');
      for (const sourceId of sourceDocumentIds) {
        const sourceDocRef = doc(db, 'sourceDocuments', sourceId);
        await updateDoc(sourceDocRef, { documentId: documentRef.id });
      }

      setProgress(100);

      // Close modal if provided, otherwise navigate
      if (onClose) {
        onClose();
      }
      
      // Navigate to editor
      navigate(`/editor/${documentRef.id}`);
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
              Supports PDF, Word (.docx, .doc), and Text (.txt) files
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
              accept=".pdf,.doc,.docx,.txt"
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
            <p className="progress-text">Uploading... {Math.round(progress)}%</p>
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
            {uploading ? 'Uploading...' : 'Upload & Extract Text'}
          </button>
        </div>
      </div>
    </div>
  );
}

