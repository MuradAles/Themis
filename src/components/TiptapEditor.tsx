import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { useEffect, useRef, useState, useCallback } from 'react';
import './TiptapEditor.css';

interface TiptapEditorProps {
  content?: string | null;
  onUpdate?: (content: string) => void;
  editable?: boolean;
  onEditorReady?: (editor: Editor | null) => void;
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export default function TiptapEditor({
  content,
  onUpdate,
  editable = true,
  onEditorReady,
  margins = { top: 72, bottom: 72, left: 72, right: 72 },
}: TiptapEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: content || '<p></p>',
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
      // Recalculate pages after content update
      setTimeout(() => calculatePages(), 50);
    },
  });

  // Calculate how many pages are needed and apply mask to hide content in gaps
  const calculatePages = useCallback(() => {
    if (!editor || !editorContentRef.current || !editorContainerRef.current) return;
    
    const editorElement = editorContentRef.current.querySelector('.ProseMirror');
    if (!editorElement) return;
    
    // Get actual content height
    const contentHeight = (editorElement as HTMLElement).scrollHeight;
    const availableHeightPerPage = 1123 - margins.top - margins.bottom;
    const pagesNeeded = Math.max(1, Math.ceil(contentHeight / availableHeightPerPage));
    
    setPageCount(pagesNeeded);
    
    // Update container height to fit all pages
    const containerHeight = pagesNeeded * 1123 + (pagesNeeded - 1) * 20; // pages + gaps
    editorContainerRef.current.style.minHeight = `${containerHeight}px`;
    
    // Apply mask to hide content in gaps between pages
    const el = editorElement as HTMLElement;
    const pageGap = 20;
    const pageHeight = 1123;
    
    // Build gradient stops: show content on pages, hide in gaps
    const stops: string[] = [];
    
    for (let i = 0; i < pagesNeeded; i++) {
      const pageTop = i * (pageHeight + pageGap);
      const contentStart = pageTop + margins.top;
      const contentEnd = pageTop + pageHeight - margins.bottom;
      
      // Start of page (transparent for top margin)
      if (i === 0) {
        stops.push(`transparent 0px`);
      } else {
        // Gap from previous page (transparent)
        stops.push(`transparent ${pageTop - pageGap}px`);
      }
      
      // Content area (black - visible)
      stops.push(`black ${contentStart}px`);
      stops.push(`black ${contentEnd}px`);
      
      // End of page (transparent for bottom margin and gap)
      stops.push(`transparent ${pageTop + pageHeight}px`);
      
      if (i < pagesNeeded - 1) {
        stops.push(`transparent ${pageTop + pageHeight + pageGap}px`);
      }
    }
    
    // Create mask gradient
    const maskValue = `linear-gradient(to bottom, ${stops.join(', ')})`;
    el.style.maskImage = maskValue;
    el.style.webkitMaskImage = maskValue;
  }, [editor, margins]);

  // Apply margins and calculate pages
  useEffect(() => {
    if (editorContentRef.current && editor) {
      const editorElement = editorContentRef.current.querySelector('.ProseMirror');
      if (editorElement) {
        const el = editorElement as HTMLElement;
        el.style.paddingTop = `${margins.top}px`;
        el.style.paddingBottom = `${margins.bottom}px`;
        el.style.paddingLeft = `${margins.left}px`;
        el.style.paddingRight = `${margins.right}px`;
        
        // Calculate pages after margins are applied
        setTimeout(() => calculatePages(), 100);
      }
    }
  }, [editor, margins, calculatePages]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      // Only update if content is different to avoid unnecessary updates
      if (currentContent !== content) {
        editor.commands.setContent(content || '<p></p>');
      }
    }
  }, [editor, content]);

  if (!editor) {
    return (
      <div className="tiptap-loading">
        <p>Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="tiptap-editor-wrapper">
      <div className="pagedjs-content">
        <div className="a4-page-editor" ref={editorContainerRef}>
          {/* Single editor - flows naturally, positioned absolutely */}
          <div ref={editorContentRef} className="tiptap-editor-content-flow">
            <EditorContent editor={editor} className="tiptap-editor-inner" />
          </div>
          
          {/* Render A4 page containers that clip the editor */}
          {Array.from({ length: pageCount }).map((_, pageIndex) => (
            <div 
              key={pageIndex} 
              className="a4-page-container"
              style={{
                top: `${pageIndex * (1123 + 20)}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

