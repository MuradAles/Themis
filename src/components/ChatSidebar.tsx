import { useState, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, functions, storage } from '../services/firebase';
import ChatMessage from './ChatMessage';
import './ChatSidebar.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'ai';
  timestamp: Date;
}

interface SourceDocument {
  id: string;
  name: string;
  uploadedAt: any;
}

interface Template {
  id: string;
  name: string;
  content: string;
  isSystemDefault: boolean;
}

interface ChatSidebarProps {
  currentLetter?: string;
  sourceDocumentIds?: string[];
  onLetterUpdate?: (updatedLetter: string) => void;
  onDocumentsUpdate?: (documentIds: string[]) => void;
  documentId?: string;
}

export default function ChatSidebar({
  currentLetter,
  sourceDocumentIds = [],
  onLetterUpdate,
  onDocumentsUpdate,
  documentId,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);
  
  // Document management state
  const [showDocumentSelection, setShowDocumentSelection] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<SourceDocument[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<SourceDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Template management state
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('Default');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available documents when selection panel opens
  useEffect(() => {
    if (showDocumentSelection) {
      loadAvailableDocuments();
    }
  }, [showDocumentSelection]);

  // Load attached document names
  useEffect(() => {
    if (sourceDocumentIds.length > 0) {
      loadAttachedDocuments();
    } else {
      setAttachedDocuments([]);
    }
  }, [sourceDocumentIds]);

  // Load available templates on mount
  useEffect(() => {
    loadAvailableTemplates();
  }, []);

  // Load names of attached documents
  const loadAttachedDocuments = async () => {
    if (sourceDocumentIds.length === 0) return;

    try {
      const docs: SourceDocument[] = [];
      for (const docId of sourceDocumentIds) {
        const docRef = doc(db, 'sourceDocuments', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          docs.push({
            id: docSnap.id,
            name: data.name || docSnap.id,
            uploadedAt: data.uploadedAt,
          });
        }
      }
      setAttachedDocuments(docs);
    } catch (error) {
      console.error('Error loading attached documents:', error);
    }
  };

  // Load available templates
  const loadAvailableTemplates = async () => {
    if (!auth.currentUser) return;
    
    try {
      const q = query(
        collection(db, 'templates'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const temps: Template[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        temps.push({
          id: doc.id,
          name: data.name || doc.id,
          content: data.content || '',
          isSystemDefault: data.isSystemDefault || false,
        });
      });
      
      // Load system default template as well
      const systemQuery = query(
        collection(db, 'templates'),
        where('isSystemDefault', '==', true)
      );
      const systemSnapshot = await getDocs(systemQuery);
      systemSnapshot.forEach((doc) => {
        const data = doc.data();
        temps.push({
          id: doc.id,
          name: data.name || 'Default',
          content: data.content || '',
          isSystemDefault: true,
        });
      });

      // Sort: system default first, then user templates
      temps.sort((a, b) => {
        if (a.isSystemDefault && !b.isSystemDefault) return -1;
        if (!a.isSystemDefault && b.isSystemDefault) return 1;
        return 0;
      });

      setAvailableTemplates(temps);
      
      // Set default template if available
      const defaultTemplate = temps.find(t => t.isSystemDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        setSelectedTemplateName(defaultTemplate.name);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  // Load user's available documents
  const loadAvailableDocuments = async () => {
    if (!auth.currentUser) return;
    
    try {
      const q = query(
        collection(db, 'sourceDocuments'),
        where('userId', '==', auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const docs: SourceDocument[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({
          id: doc.id,
          name: data.name || doc.id,
          uploadedAt: data.uploadedAt,
        });
      });
      setAvailableDocuments(docs);
      // Pre-select currently attached documents
      setSelectedDocumentIds([...sourceDocumentIds]);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!auth.currentUser || !file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique document ID
      const docId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storagePath = `documents/${auth.currentUser.uid}/${docId}.pdf`;
      
      // Upload to Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      setUploadProgress(50);

      // Save metadata to Firestore
      const docRef = await addDoc(collection(db, 'sourceDocuments'), {
        name: file.name,
        storagePath,
        userId: auth.currentUser.uid,
        uploadedAt: serverTimestamp(),
        fileSize: file.size,
        mimeType: file.type,
      });

      setUploadProgress(100);

      // Auto-attach to current letter
      if (onDocumentsUpdate) {
        const newIds = [...sourceDocumentIds, docRef.id];
        onDocumentsUpdate(newIds);
      }

      // Reload available documents
      await loadAvailableDocuments();
      
      setUploading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Handle document selection
  const handleDocumentToggle = (docId: string) => {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(docId)) {
        return prev.filter((id) => id !== docId);
      } else {
        return [...prev, docId];
      }
    });
  };

  // Apply selected documents
  const handleApplySelection = () => {
    if (onDocumentsUpdate) {
      onDocumentsUpdate(selectedDocumentIds);
    }
    setShowDocumentSelection(false);
  };

  // Remove attached document
  const handleRemoveDocument = (docId: string) => {
    if (onDocumentsUpdate) {
      const newIds = sourceDocumentIds.filter((id) => id !== docId);
      onDocumentsUpdate(newIds);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageText = inputValue.trim().toLowerCase();
    // Detect if user wants to create/generate a letter
    const isGenerateCommand = 
      messageText.includes('create demand letter') ||
      messageText.includes('generate letter') ||
      messageText.includes('create letter') ||
      messageText.includes('make a letter') ||
      (messageText.includes('create') && (messageText.includes('letter') || messageText.includes('document'))) ||
      (messageText.startsWith('create') && sourceDocumentIds.length > 0) ||
      (messageText.includes('generate') && sourceDocumentIds.length > 0);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // If it's a generate letter command and we have documents
      if (isGenerateCommand && sourceDocumentIds.length > 0) {
        const generateLetter = httpsCallable(functions, 'generateLetter');
        const result = await generateLetter({
          sourceDocumentIds,
          templateId: selectedTemplateId || undefined,
          currentLetter: currentLetter || undefined,
        });

        const data = result.data as { letter: string };
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'I\'ve generated a demand letter based on the attached documents. The letter has been added to your editor.',
          role: 'ai',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Update the letter in editor
        if (data.letter && onLetterUpdate) {
          onLetterUpdate(data.letter);
        }
      } else {
        // Regular chat with streaming
      const conversationHistory = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

        // Get auth token for streaming request
        const authToken = await auth.currentUser?.getIdToken();
        if (!authToken) {
          throw new Error('Not authenticated');
        }

        // Get the function URL
        const projectId = functions.app.options.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID;
        const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/chatWithAIStream`;

        // Create streaming AI message
        const aiMessageId = (Date.now() + 1).toString();
        const aiMessage: Message = {
          id: aiMessageId,
          content: '',
          role: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Stream the response
        let accumulatedMessage = '';
        let documentContent = '';

        try {
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
        message: userMessage.content,
        sourceDocumentIds: sourceDocumentIds.length > 0 ? sourceDocumentIds : undefined,
        conversationHistory,
        currentLetter: currentLetter || undefined,
              authToken,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No response body');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.type === 'message' || data.type === 'message_final') {
                    // Update chat message progressively
                    accumulatedMessage += data.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? { ...msg, content: accumulatedMessage }
                          : msg
                      )
                    );
                  } else if (data.type === 'document' || data.type === 'document_final') {
                    // Update document when complete
                    documentContent = data.content;
                    if (onLetterUpdate) {
                      onLetterUpdate(documentContent);
                    }
                  } else if (data.type === 'document_partial') {
                    // Update document progressively (optional - can be noisy)
                    // Uncomment if you want real-time document updates as it streams
                    // if (onLetterUpdate) {
                    //   onLetterUpdate(data.content);
                    // }
                  } else if (data.type === 'error') {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? { ...msg, content: `Error: ${data.content}` }
                          : msg
                      )
                    );
                  } else if (data.type === 'done') {
                    // Finalize: ensure document is updated if we have it
                    if (documentContent && onLetterUpdate) {
                      onLetterUpdate(documentContent);
                    }
                    // Clean up final message if needed
                    if (accumulatedMessage.includes('UPDATED_DOCUMENT_START')) {
                      const cleaned = accumulatedMessage.replace(/UPDATED_DOCUMENT_START[\s\S]*?UPDATED_DOCUMENT_END/i, '').trim();
                      const finalContent = cleaned || "I've updated the document.";
                      // Only update if message has content, otherwise remove it
                      if (finalContent.trim().length > 0) {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === aiMessageId
                              ? { ...msg, content: finalContent }
                              : msg
                          )
                        );
                      } else {
                        // Remove empty message
                        setMessages((prev) => prev.filter((msg) => msg.id !== aiMessageId));
                      }
                    } else if (accumulatedMessage.trim().length === 0) {
                      // Remove empty message if no content was accumulated
                      setMessages((prev) => prev.filter((msg) => msg.id !== aiMessageId));
                    }
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                  console.warn('Failed to parse SSE data:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
                : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Check for @ mention
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // If there's no space after @, show mention dropdown
      if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
        setMentionPosition(lastAtIndex);
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  return (
    <div className="chat-sidebar-container">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <p className="chat-subtitle">Ask questions or request changes to your letter</p>
      </div>

      {/* Template Selection Section */}
      <div className="template-selection-section">
        <label className="template-label">
          📋 Template:
          <select 
            className="template-selector"
            value={selectedTemplateId}
            onChange={(e) => {
              const templateId = e.target.value;
              const template = availableTemplates.find(t => t.id === templateId);
              setSelectedTemplateId(templateId);
              setSelectedTemplateName(template?.name || 'Default');
            }}
          >
            {availableTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} {template.isSystemDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Document Management Section */}
      <div className="document-management-section">
        {/* Select Documents Button */}
        <button
          className="select-documents-button"
          onClick={() => setShowDocumentSelection(!showDocumentSelection)}
        >
          {showDocumentSelection ? '▼' : '▶'} Select Documents
        </button>

        {/* Document Selection Panel */}
        {showDocumentSelection && (
          <div className="document-selection-panel">
            {/* Upload Area */}
            <div
              ref={dropZoneRef}
              className="upload-area"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              {uploading ? (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p>Uploading... {uploadProgress}%</p>
                </div>
              ) : (
                <>
                  <p>📄 Drag & drop PDF here or</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="upload-button"
                  >
                    Browse Files
                  </button>
                </>
              )}
            </div>

            {/* Available Documents List */}
            {availableDocuments.length > 0 && (
              <div className="available-documents">
                <h4>Your Documents:</h4>
                {availableDocuments.map((doc) => (
                  <label key={doc.id} className="document-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(doc.id)}
                      onChange={() => handleDocumentToggle(doc.id)}
                    />
                    <span>{doc.name}</span>
                  </label>
                ))}
                <button
                  className="apply-selection-button"
                  onClick={handleApplySelection}
                >
                  Apply Selection ({selectedDocumentIds.length} selected)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Attached Documents Display */}
        {sourceDocumentIds.length > 0 && (
          <div className="attached-documents">
            <h4>📎 Attached Documents ({sourceDocumentIds.length})</h4>
            <div className="attached-docs-list">
              {attachedDocuments.map((doc) => (
                <div key={doc.id} className="attached-doc-item">
                  <span>{doc.name}</span>
                  <button
                    onClick={() => handleRemoveDocument(doc.id)}
                    className="remove-doc-button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty-state">
            <p>Start a conversation with the AI assistant.</p>
            <p className="chat-hint">Try asking: "Make the tone more formal" or "Add a paragraph about damages"</p>
          </div>
        )}
        {messages
          .filter((message) => message.content.trim().length > 0 || message.role === 'user')
          .map((message) => (
          <ChatMessage
            key={message.id}
            message={message.content}
            role={message.role}
            timestamp={message.timestamp}
          />
        ))}
        {isLoading && (
          <div className="chat-loading">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="chat-input"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className="chat-send-button"
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        {showMentionDropdown && sourceDocumentIds.length > 0 && (
          <div className="mention-dropdown">
            <div className="mention-dropdown-header">Reference documents:</div>
            {sourceDocumentIds.map((docId) => (
              <button
                key={docId}
                className="mention-item"
                onClick={() => {
                  const beforeAt = inputValue.substring(0, mentionPosition);
                  const afterAt = inputValue.substring(inputRef.current?.selectionStart || inputValue.length);
                  setInputValue(`${beforeAt}@${docId} ${afterAt}`);
                  setShowMentionDropdown(false);
                  inputRef.current?.focus();
                }}
              >
                @{docId.substring(0, 20)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

