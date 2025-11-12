# Active Context: Themis

## Current Work Focus

**Status:** Phase 1, 2, 3, 4, 5, 6, 7 & 8 Complete  
**Date:** November 2025  
**Phase:** Chat Sidebar with Streaming AI Complete - Ready for Polish & Testing

## Recent Changes

### Completed
- ✅ Project initialized with React + TypeScript + Vite template
- ✅ Firebase project configured (themis-law)
- ✅ Firebase Functions created (3 functions: generateLetter, chatWithAI, chatWithAIStream)
- ✅ Firestore security rules configured
- ✅ Storage security rules created (not used, but configured)
- ✅ Frontend dependencies installed
- ✅ Folder structure created (components/, pages/, services/)
- ✅ Firebase service file created
- ✅ Functions cleaned up (removed Storage dependencies, updated to use Firestore only)
- ✅ **Phase 3 Complete:** Authentication & Routing
  - ✅ React Router configured
  - ✅ Login page with email/password and Google sign-in
  - ✅ Protected routes implemented
  - ✅ ProtectedRoute component (auth-only, no Firestore)
- ✅ **Phase 4 Complete:** Documents List Page
- ✅ **Phase 5 Complete:** Document Upload with text extraction
- ✅ **Phase 6 Complete:** Editor Page Layout (header, toolbar, chat toggle)
- ✅ **Phase 7 Complete:** Tiptap Editor with A4 Pagination
  - ✅ Tiptap editor integrated with formatting buttons
  - ✅ A4 page format (794px × 1123px) with configurable margins
  - ✅ Multi-page pagination with automatic page creation
  - ✅ CSS mask to hide content in gaps between pages
  - ✅ Save functionality with auto-save (30s interval)
  - ✅ Change tracking CSS styles ready
- ✅ **Phase 8 Complete:** Chat Sidebar with Streaming AI
  - ✅ Streaming AI chat with real-time updates
  - ✅ Document management (upload, attach, select)
  - ✅ AI document updates with clean confirmations
  - ✅ Empty message filtering
  - ✅ Document newline cleanup
- ✅ **PDF Processing Enhancement:** OpenAI Files API Integration
  - ✅ Replaced pdf-parse with OpenAI Files API for PDF processing
  - ✅ PDFs uploaded to OpenAI and referenced in chat completions
  - ✅ Using gpt-4o model for document reading and extraction
  - ✅ File cleanup after processing (delete from OpenAI)
- ✅ **Formatting Improvements:** Clean HTML Output
  - ✅ Removed markdown code blocks from AI output
  - ✅ Removed explanatory text and comments from documents
  - ✅ Updated prompts to enforce clean HTML only
  - ✅ Added cleanup code to strip unwanted content
- ✅ Memory bank documentation established

### Next Steps
1. **Phase 9: Word Export** (Priority: Medium)
   - Connect export button to exportToWord function
   - Handle file download
   - Test export functionality

2. **Enhanced Document Extraction** (Priority: Low - Future Enhancement)
   - Create `analyzeDocument` Firebase Function
   - Implement hybrid extraction approach:
     - Try text extraction first (fast, cheap)
     - If text extraction fails/poor → Use AI Vision API
   - Convert PDF pages to images for AI Vision
   - Extract structured information (parties, dates, amounts, etc.)
   - Save structured data to Firestore
   - Update DocumentUpload component to use new approach

## Active Decisions

### Architecture Decisions
- **Backend:** Firebase (BaaS) chosen for rapid development
- **Editor:** Tiptap selected for rich text editing with collaboration
- **AI Provider:** OpenAI API for text generation and document analysis
  - **Text Generation:** GPT-4 for letter generation and refinement
  - **Document Analysis:** GPT-4 Vision for scanned PDFs and complex layouts
- **Data Storage:** Firestore only (NO Firebase Storage used)
- **Data Flow:** 
  - Upload → Try text extraction → If poor/fails → AI Vision analysis → Save structured data to Firestore
  - Generate Letter → Read structured data from Firestore → AI generates → Save letter to Firestore
- **Document Extraction:** Hybrid approach (text extraction + AI Vision fallback)
- **Export:** Direct download (base64 buffer), NOT saved to Storage
- **Deployment:** Firebase Hosting for frontend, Functions for backend

### Implementation Priorities
1. **P0 (Must-Have):**
   - User authentication ✅ (Firebase configured)
   - Document upload with text extraction
   - AI letter generation ✅ (Function created)
   - Basic editor functionality
   - Word export ✅ (Function created)

2. **P1 (Should-Have):**
   - Real-time collaboration
   - Chat interface for refinements ✅ (Function created)
   - Change tracking

3. **P2 (Nice-to-Have):**
   - Third-party integrations
   - Advanced formatting
   - Analytics

### Current Blockers
- None identified at this stage

### Open Questions
1. **Document Extraction:**
   - What structured fields should we extract? (parties, dates, amounts, case details, etc.)
   - Should we always use AI Vision or only as fallback?
   - How to handle multi-page PDFs efficiently?

2. **UI/UX:**
   - Design system preferences?
   - Color scheme and branding?

3. **Features:**
   - Specific template requirements?
   - Collaboration features priority?

## Development Environment

### Current Setup
- ✅ React + TypeScript + Vite project initialized
- ✅ Basic file structure in place (components/, pages/, services/)
- ✅ ESLint configured
- ✅ Firebase integration complete (Auth, Firestore, Functions)
- ✅ All frontend dependencies installed
- ✅ Firebase Functions created and cleaned
- ✅ Firebase service file created

### Completed Setup Steps
1. ✅ Install Firebase CLI
2. ✅ Create Firebase project (themis-law)
3. ✅ Initialize Firebase in project
4. ✅ Install frontend dependencies
5. ✅ Set up Firebase Functions
6. ✅ Configure OpenAI secret

## Key Files to Create

### Completed Files
- ✅ `src/services/firebase.ts` - Firebase initialization
- ✅ `functions/src/index.ts` - Backend functions (4 functions created)
- ✅ `src/pages/Login.tsx` - Authentication page (email/password + Google)
- ✅ `src/pages/Login.css` - Login page styling
- ✅ `src/components/ProtectedRoute.tsx` - Protected route wrapper
- ✅ `src/App.tsx` - Router setup with routes

### Immediate Priority
- `src/pages/DocumentsList.tsx` - Document management
- `src/pages/Editor.tsx` - Letter editor

### Components Needed
- `src/components/DocumentCard.tsx`
- `src/components/DocumentUpload.tsx`
- `src/components/TiptapEditor.tsx`
- `src/components/ChatSidebar.tsx`

## Notes and Considerations

### Important Reminders
- Maintain type safety with TypeScript
- Follow Firebase security best practices
- Implement proper error handling
- Add loading states for all async operations
- Ensure responsive design

### Code Quality Standards
- Use TypeScript strict mode
- Follow ESLint rules
- Write self-documenting code
- Add comments for complex logic
- Maintain consistent code style

### Testing Considerations
- Test authentication flow
- Test document upload and retrieval
- Test AI generation accuracy
- Test export functionality
- Test error scenarios

## Communication Notes

- Phase 1, 2, 3, 4, 5, 6 & 7 complete (setup, functions code, authentication, documents list, upload, editor layout, and tiptap editor)
- Architecture clarified: NO Firebase Storage used
- All data stored in Firestore (extracted text + letters)
- Export returns base64 buffer for direct download
- Authentication working: Email/Password + Google Sign-In
- Protected routes implemented (auth-only check, no Firestore)
- Documents List page complete with Firestore integration
- Document Upload complete with client-side text extraction
- **Editor Complete:** Tiptap editor with A4 page format, configurable margins, and multi-page pagination
- **Pagination Implementation:** 
  - Single Tiptap editor spans all pages (positioned absolutely)
  - Multiple page containers positioned at calculated offsets (20px gaps)
  - CSS mask-image with linear gradient hides content in margins and gaps
  - Content visible only in content areas (between margins) on each page
  - Automatic page creation when content exceeds single page height
- **Phase 8 Complete:** Chat Sidebar with streaming AI, document management, and real-time document updates
- **Streaming Implementation:** Real-time AI responses with document updates, filtered markers, and clean confirmations
- **Next:** Phase 9 - Word Export implementation
- **Future Enhancement:** Handle scanned PDFs and complex layouts using AI Vision API (hybrid extraction approach)

## Next Session Priorities

When continuing work:
1. Review this active context
2. Check progress.md for completed items
3. Review systemPatterns.md for architecture decisions
4. Continue with highest priority tasks from task list

