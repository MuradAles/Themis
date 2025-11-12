import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Editor as TiptapEditorType } from '@tiptap/react';
import { saveAs } from 'file-saver';
import { Document as WordDocument, Packer, Paragraph, TextRun } from 'docx';
import { auth, db } from '../services/firebase';
import TiptapEditor from '../components/TiptapEditor';
import ChatSidebar from '../components/ChatSidebar';
import './Editor.css';

interface Document {
  id: string;
  title: string;
  content: string | null;
  format: string;
  status: 'draft' | 'completed';
  sourceDocumentIds?: string[];
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export default function Editor() {
  const { documentId } = useParams<{ documentId?: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [showMarginSettings, setShowMarginSettings] = useState(false);
  const [editor, setEditor] = useState<TiptapEditorType | null>(null);
  const [toolbarUpdate, setToolbarUpdate] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [margins, setMargins] = useState({ top: 72, bottom: 72, left: 72, right: 72 }); // Default: 1 inch (72px) all around
  const [pageCount, setPageCount] = useState(1);
  const [exporting, setExporting] = useState(false);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const pageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) {
        // New document - create placeholder
        setDocument({
          id: 'new',
          title: 'New Document',
          content: null,
          format: 'Standard',
          status: 'draft',
          margins: { top: 72, bottom: 72, left: 72, right: 72 },
        });
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'documents', documentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();
          setDocument({
            id: docSnap.id,
            ...docData,
          } as Document);
          // Load margins if they exist, otherwise use defaults
          if (docData.margins) {
            setMargins(docData.margins);
          }
        } else {
          setError('Document not found');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading document:', err);
        setError('Failed to load document. Please try again.');
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  const saveToFirestore = useCallback(async (content: string) => {
    if (!document || !auth.currentUser) return;

    try {
      setSaveStatus('saving');
      const docRef = doc(db, 'documents', document.id);

      if (document.id === 'new') {
        // Create new document
        const newDoc = {
          title: document.title || '',
          content,
          format: document.format || 'Standard',
          status: 'draft' as const,
          userId: auth.currentUser.uid,
          margins,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, newDoc);
        // Update local document state with new ID
        setDocument({ ...document, id: docRef.id, margins });
      } else {
        // Update existing document
        await updateDoc(docRef, {
          content,
          margins,
          updatedAt: serverTimestamp(),
        });
      }

      // Save to localStorage as backup
      const backupKey = `document_backup_${document.id}`;
      localStorage.setItem(backupKey, JSON.stringify({
        content,
        timestamp: Date.now(),
      }));

      lastSavedContentRef.current = content;
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error saving document:', err);
      setSaveStatus('unsaved');
      throw err;
    }
  }, [document]);

  // Initialize lastSavedContentRef when document loads
  useEffect(() => {
    if (document?.content) {
      lastSavedContentRef.current = document.content;
      setCurrentContent(document.content);
    }
    if (document?.margins) {
      setMargins(document.margins);
    }
  }, [document?.content, document?.margins]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!editor || !document || document.id === 'new') return;

    // Clear existing interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    // Set up auto-save
    const autoSave = () => {
      if (editor && currentContent && currentContent !== lastSavedContentRef.current) {
        const content = editor.getHTML();
        saveToFirestore(content).catch((err) => {
          console.error('Auto-save failed:', err);
        });
      }
    };

    autoSaveIntervalRef.current = setInterval(autoSave, 30000); // 30 seconds

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [editor, document, currentContent, saveToFirestore]);

  // Track content changes and update page count
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const content = editor.getHTML();
      setCurrentContent(content);

      // Update save status
      if (content !== lastSavedContentRef.current) {
        setSaveStatus('unsaved');
      } else {
        setSaveStatus('saved');
      }

      // Calculate pages needed - use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          const pages = calculatePages();
          if (pages !== pageCount) {
            setPageCount(pages);
          }
        }, 50);
      });
    };

    editor.on('update', handleUpdate);
    editor.on('transaction', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor, margins]);

  // Calculate available content height per page
  const getContentHeight = () => {
    return 1123 - margins.top - margins.bottom; // A4 height minus margins
  };

  // Calculate number of pages needed based on content
  const calculatePages = () => {
    if (!editor || !pageContentRef.current) return 1;
    
    const editorElement = pageContentRef.current.querySelector('.ProseMirror');
    if (!editorElement) return 1;
    
    // Use getBoundingClientRect to get actual rendered height
    const contentHeight = editorElement.getBoundingClientRect().height;
    const pageHeight = getContentHeight();
    const pagesNeeded = Math.max(1, Math.ceil(contentHeight / pageHeight));
    
    // Force re-render if page count changes
    return pagesNeeded;
  };

  const handleBack = () => {
    navigate('/documents');
  };

  const handleSave = async () => {
    if (!editor) return;

    const content = editor.getHTML();
    try {
      await saveToFirestore(content);
      setCurrentContent(content);
    } catch (err) {
      alert('Failed to save document. Please try again.');
    }
  };

  const handleExport = async () => {
    if (!editor || !document) {
      return;
    }

    try {
      setExporting(true);
      
      // Get the current editor content (HTML from Tiptap)
      const htmlContent = editor.getHTML();
      
      // Parse HTML and convert to Word document structure
      const tempDiv = window.document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      // Debug: Log the HTML structure to understand what we're working with
      console.log('HTML Content for export:', htmlContent);
      console.log('Number of <p> tags:', tempDiv.querySelectorAll('p').length);
      
      const wordParagraphs: Paragraph[] = [];
      
      // Helper function to convert HTML element to Word TextRun with formatting
      const createTextRuns = (element: HTMLElement): TextRun[] => {
        const runs: TextRun[] = [];
        
        const processNode = (node: Node, isBold: boolean, isItalic: boolean, isUnderline: boolean) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.length > 0) {
              runs.push(new TextRun({
                text: text,
                size: 24, // 12pt
                bold: isBold,
                italics: isItalic,
                underline: isUnderline ? {} : undefined,
              }));
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();
            
            // Update formatting flags (allow multiple formats at once)
            let newBold = isBold;
            let newItalic = isItalic;
            let newUnderline = isUnderline;
            
            if (tagName === 'strong' || tagName === 'b') {
              newBold = true;
            }
            if (tagName === 'em' || tagName === 'i') {
              newItalic = true;
            }
            if (tagName === 'u') {
              newUnderline = true;
            }
            
            // Process all child nodes
            Array.from(el.childNodes).forEach(child => {
              processNode(child, newBold, newItalic, newUnderline);
            });
          }
        };
        
        // Start processing from the element
        Array.from(element.childNodes).forEach(child => {
          processNode(child, false, false, false);
        });
        
        return runs;
      };
      
      // Process all top-level elements
      const processNode = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          
          if (tagName === 'p') {
            // Check if paragraph contains <br> tags - split into multiple paragraphs
            const brElements = element.querySelectorAll('br');
            if (brElements.length > 0) {
              // Split by <br> tags
              const parts: HTMLElement[] = [];
              let currentPart = window.document.createElement('span');
              
              Array.from(element.childNodes).forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === 'br') {
                  // Save current part and start new one
                  if (currentPart.childNodes.length > 0) {
                    parts.push(currentPart);
                  }
                  currentPart = window.document.createElement('span');
                } else {
                  currentPart.appendChild(node.cloneNode(true));
                }
              });
              
              // Add last part if it has content
              if (currentPart.childNodes.length > 0) {
                parts.push(currentPart);
              }
              
              // Create a paragraph for each part (including empty ones to preserve line breaks)
              parts.forEach((part) => {
                const textRuns = createTextRuns(part);
                wordParagraphs.push(new Paragraph({
                  children: textRuns.length > 0 ? textRuns : [new TextRun({ text: '', size: 24 })],
                  spacing: {
                    after: 200,
                  },
                }));
              });
            } else {
              // No <br> tags - single paragraph (always create, even if empty)
              // IMPORTANT: Each <p> tag must create a separate paragraph in Word
              const textRuns = createTextRuns(element);
              // Always create a new paragraph for each <p> tag, regardless of content
              wordParagraphs.push(new Paragraph({
                children: textRuns.length > 0 ? textRuns : [new TextRun({ text: '', size: 24 })],
                spacing: {
                  after: 200, // 10pt spacing after paragraph
                },
              }));
            }
          } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
            const level = parseInt(tagName.charAt(1));
            const textRuns = createTextRuns(element);
            // Always create heading paragraph, even if empty
            // Make heading text bold and larger
            for (const run of textRuns) {
              run.options.bold = true;
              run.options.size = 24 + (6 - level) * 4; // h1 = 44pt, h2 = 40pt, etc.
            }
            wordParagraphs.push(new Paragraph({
              children: textRuns.length > 0 ? textRuns : [new TextRun({ text: '', size: 24 + (6 - level) * 4, bold: true })],
              heading: `Heading${level}` as any,
              spacing: {
                before: 400,
                after: 200,
              },
            }));
          } else if (tagName === 'ul' || tagName === 'ol') {
            const listItems = element.querySelectorAll('li');
            listItems.forEach((li) => {
              const textRuns = createTextRuns(li);
              // Always create list item paragraph, even if empty
              wordParagraphs.push(new Paragraph({
                children: textRuns.length > 0 ? textRuns : [new TextRun({ text: '', size: 24 })],
                bullet: tagName === 'ul' ? { level: 0 } : undefined,
                numbering: tagName === 'ol' ? { level: 0 } : undefined,
                spacing: {
                  after: 100,
                },
              }));
            });
          } else if (tagName === 'blockquote') {
            const textRuns = createTextRuns(element);
            if (textRuns.length > 0) {
              // Make blockquote italic
              for (const run of textRuns) {
                run.options.italics = true;
              }
              wordParagraphs.push(new Paragraph({
                children: textRuns,
                indent: { left: 400 }, // Indent blockquote
                spacing: {
                  after: 200,
                },
              }));
            }
          } else if (tagName === 'br') {
            // Line break - add empty paragraph
            wordParagraphs.push(new Paragraph({
              children: [new TextRun({ text: '', size: 24 })],
              spacing: { after: 200 },
            }));
          }
        }
      };
      
      // Process all child nodes of the div
      // IMPORTANT: Process each node separately to ensure each <p> tag creates a new line
      // Also process direct <p> elements if they exist (in case HTML structure is different)
      const directParagraphs = tempDiv.querySelectorAll(':scope > p');
      if (directParagraphs.length > 0) {
        // Process each <p> tag directly
        directParagraphs.forEach((pElement) => {
          processNode(pElement);
        });
      } else {
        // Fallback: process all child nodes
        Array.from(tempDiv.childNodes).forEach((node) => {
          processNode(node);
        });
      }
      
      // If no paragraphs were created, create one empty paragraph
      if (wordParagraphs.length === 0) {
        wordParagraphs.push(new Paragraph({
          children: [new TextRun({ text: '', size: 24 })],
        }));
      }

      // Create Word document
      const doc = new WordDocument({
        sections: [
          {
            properties: {},
            children: wordParagraphs,
          },
        ],
      });

      // Generate document blob (for browser)
      const blob = await Packer.toBlob(doc);
      const fileName = `${document.title || 'demand-letter'}-${Date.now()}.docx`;
      
      // Download the file
      saveAs(blob, fileName);
      
      setExporting(false);
    } catch (error) {
      console.error('Error exporting to Word:', error);
      setExporting(false);
      alert(`Failed to export document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDocumentsUpdate = async (documentIds: string[]) => {
    if (!document || !auth.currentUser) return;

    try {
      const docRef = doc(db, 'documents', document.id);
      
      if (document.id === 'new') {
        // If it's a new document, we need to create it first
        const newDoc = {
          title: document.title || '',
          content: document.content || '',
          format: document.format || 'Standard',
          status: 'draft' as const,
          userId: auth.currentUser.uid,
          sourceDocumentIds: documentIds,
          margins: document.margins || margins,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, newDoc);
        setDocument({ ...document, id: docRef.id, sourceDocumentIds: documentIds });
      } else {
        // Update existing document
        await updateDoc(docRef, {
          sourceDocumentIds: documentIds,
          updatedAt: serverTimestamp(),
        });
        setDocument({ ...document, sourceDocumentIds: documentIds });
      }
    } catch (error) {
      console.error('Error updating documents:', error);
    }
  };

  const handleLetterUpdate = async (updatedLetter: string) => {
    if (!editor || !document) return;

    // Clean the content - remove leading/trailing whitespace and newlines
    let cleanedContent = updatedLetter.trim();
    
    // If content is already HTML, use it directly
    if (cleanedContent.includes('<p>') || cleanedContent.includes('<div>')) {
      // Remove leading/trailing empty paragraphs
      cleanedContent = cleanedContent.replace(/^<p>\s*<\/p>\s*/i, '');
      cleanedContent = cleanedContent.replace(/\s*<p>\s*<\/p>$/i, '');
      editor.commands.setContent(cleanedContent || '<p></p>');
    } else {
      // Convert plain text to HTML paragraphs
      // Split by double newlines, filter out empty paragraphs
      const paragraphs = cleanedContent
        .split('\n\n')
        .map((para) => para.trim())
        .filter((para) => para.length > 0)
        .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`);
      
      const htmlContent = paragraphs.join('');
      editor.commands.setContent(htmlContent || '<p></p>');
    }
    
    // Auto-save the updated content
    const newContent = editor.getHTML();
    await saveToFirestore(newContent);
    
    // Document updated - no alert needed, chat will confirm
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  // Toolbar button handlers
  const handleBold = () => {
    editor?.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    editor?.chain().focus().toggleItalic().run();
  };

  const handleUnderline = () => {
    editor?.chain().focus().toggleUnderline().run();
  };

  const handleHeading1 = () => {
    editor?.chain().focus().toggleHeading({ level: 1 }).run();
  };

  const handleHeading2 = () => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  };

  const handleBulletList = () => {
    editor?.chain().focus().toggleBulletList().run();
  };

  const handleOrderedList = () => {
    editor?.chain().focus().toggleOrderedList().run();
  };

  const handleBlockquote = () => {
    editor?.chain().focus().toggleBlockquote().run();
  };

  const handleLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleMarginChange = (side: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    const newMargins = { ...margins, [side]: Math.max(0, value) };
    setMargins(newMargins);
    // Auto-save margins
    if (document && document.id !== 'new') {
      updateDoc(doc(db, 'documents', document.id), {
        margins: newMargins,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        console.error('Error saving margins:', err);
      });
    }
  };

  const saveMargins = async () => {
    if (!document || document.id === 'new') return;
    try {
      await updateDoc(doc(db, 'documents', document.id), {
        margins,
        updatedAt: serverTimestamp(),
      });
      setShowMarginSettings(false);
    } catch (err) {
      console.error('Error saving margins:', err);
      alert('Failed to save margin settings.');
    }
  };

  if (loading) {
    return (
      <div className="editor-container">
        <div className="loading-state">Loading document...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-container">
        <div className="error-state">{error}</div>
        <button onClick={handleBack} className="back-button">
          ← Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <button onClick={handleBack} className="back-button">
            ← Back
          </button>
          <input
            type="text"
            className="document-title-input"
            value={document?.title || ''}
            onChange={(e) => {
              const newTitle = e.target.value;
              setDocument({ ...document!, title: newTitle });
              // Auto-save title
              if (document && document.id !== 'new' && auth.currentUser) {
                updateDoc(doc(db, 'documents', document.id), {
                  title: newTitle,
                  updatedAt: serverTimestamp(),
                }).catch((err) => {
                  console.error('Error saving title:', err);
                });
              }
            }}
            onBlur={async () => {
              // Save title when user finishes editing
              if (document && document.id !== 'new' && auth.currentUser) {
                try {
                  await updateDoc(doc(db, 'documents', document.id), {
                    title: document.title || '',
                    updatedAt: serverTimestamp(),
                  });
                } catch (err) {
                  console.error('Error saving title:', err);
                }
              }
            }}
            placeholder="Document title..."
          />
        </div>
        <div className="header-actions">
          <div className="save-status-container">
            {saveStatus === 'saving' && (
              <span className="save-status saving">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="save-status saved">Saved</span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="save-status unsaved">Unsaved changes</span>
            )}
          </div>
          <button
            onClick={handleSave}
            className="save-button"
            disabled={saveStatus === 'saving' || !editor}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={handleExport} 
            className="export-button"
            disabled={exporting || !editor || !document}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-formatting">
          <button
            className={`toolbar-button ${editor?.isActive('bold') ? 'active' : ''}`}
            onClick={handleBold}
            title="Bold"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            <strong>B</strong>
          </button>
          <button
            className={`toolbar-button ${editor?.isActive('italic') ? 'active' : ''}`}
            onClick={handleItalic}
            title="Italic"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            <em>I</em>
          </button>
          <button
            className={`toolbar-button ${editor?.isActive('underline') ? 'active' : ''}`}
            onClick={handleUnderline}
            title="Underline"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            <u>U</u>
          </button>
          <div className="toolbar-separator" />
          <button
            className={`toolbar-button ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            onClick={handleHeading1}
            title="Heading 1"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            H1
          </button>
          <button
            className={`toolbar-button ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            onClick={handleHeading2}
            title="Heading 2"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            H2
          </button>
          <div className="toolbar-separator" />
          <button
            className={`toolbar-button ${editor?.isActive('bulletList') ? 'active' : ''}`}
            onClick={handleBulletList}
            title="Bullet List"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            •
          </button>
          <button
            className={`toolbar-button ${editor?.isActive('orderedList') ? 'active' : ''}`}
            onClick={handleOrderedList}
            title="Numbered List"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            1.
          </button>
          <div className="toolbar-separator" />
          <button
            className={`toolbar-button ${editor?.isActive('blockquote') ? 'active' : ''}`}
            onClick={handleBlockquote}
            title="Blockquote"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            "
          </button>
          <button
            className={`toolbar-button ${editor?.isActive('link') ? 'active' : ''}`}
            onClick={handleLink}
            title="Link"
            disabled={!editor}
            data-update={toolbarUpdate}
          >
            🔗
          </button>
        </div>
        <div className="toolbar-right">
          <div className="margin-settings-wrapper" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMarginSettings(!showMarginSettings)}
              className={`toolbar-button ${showMarginSettings ? 'active' : ''}`}
              title="Page Settings"
            >
              ⚙️
            </button>
            {/* Margin Settings Panel */}
            {showMarginSettings && (
              <div className="margin-settings-panel">
                <div className="margin-settings-header">
                  <h3>Page Margins</h3>
                  <button
                    onClick={() => setShowMarginSettings(false)}
                    className="close-button"
                  >
                    ×
                  </button>
                </div>
                <div className="margin-settings-content">
                  <div className="margin-input-group">
                    <label>Top Margin (px)</label>
                    <input
                      type="number"
                      value={margins.top}
                      onChange={(e) => handleMarginChange('top', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="margin-input-group">
                    <label>Bottom Margin (px)</label>
                    <input
                      type="number"
                      value={margins.bottom}
                      onChange={(e) => handleMarginChange('bottom', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="margin-input-group">
                    <label>Left Margin (px)</label>
                    <input
                      type="number"
                      value={margins.left}
                      onChange={(e) => handleMarginChange('left', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="margin-input-group">
                    <label>Right Margin (px)</label>
                    <input
                      type="number"
                      value={margins.right}
                      onChange={(e) => handleMarginChange('right', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="margin-settings-actions">
                    <button onClick={saveMargins} className="save-margins-button">
                      Save Margins
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleChat}
            className={`chat-toggle-button ${showChat ? 'active' : ''}`}
          >
            {showChat ? '← Hide Chat' : '→ Chat'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="editor-main-layout">
        {/* Editor Area */}
        <div className="editor-area">
          <div className="editor-container-wrapper">
            <TiptapEditor
              content={document?.content}
              margins={margins}
              onUpdate={(content) => {
                setCurrentContent(content);
                // Content changes are tracked in useEffect above
              }}
              onEditorReady={(editorInstance) => {
                setEditor(editorInstance);
                // Listen to selection updates to refresh toolbar active states
                if (editorInstance) {
                  editorInstance.on('selectionUpdate', () => {
                    setToolbarUpdate((prev) => prev + 1);
                  });
                  editorInstance.on('transaction', () => {
                    setToolbarUpdate((prev) => prev + 1);
                  });
                }
              }}
            />
          </div>
        </div>

        {/* Chat Sidebar (conditional) */}
        {showChat && (
          <div className="chat-sidebar">
            <ChatSidebar
              currentLetter={currentContent}
              sourceDocumentIds={document?.sourceDocumentIds || []}
              onLetterUpdate={handleLetterUpdate}
              onDocumentsUpdate={handleDocumentsUpdate}
              documentId={document?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

