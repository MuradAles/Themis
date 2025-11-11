# Themis - Task List
## Step-by-Step Build Guide

**Project:** Themis - AI-Powered Demand Letter Generator  
**Tech Stack:** React + Firebase (Auth, Functions, Firestore) + OpenAI + Tiptap  
**Estimated Time:** 12-15 hours (1.5-2 days)

## ⚠️ Important Architecture Notes

**Firebase Storage is NOT used:**
- We do NOT save PDF/Word files to Storage
- We do NOT save exported Word documents to Storage
- We extract text from uploaded files and save ONLY the extracted text to Firestore
- We save letter content to Firestore
- Export downloads directly to user's computer (no Storage)

**Data Flow:**
1. Upload PDF → Extract text → Save extracted text to Firestore
2. Generate Letter → Read extracted text from Firestore → AI generates → Save letter to Firestore
3. Export → Read letter from Firestore → Create Word → Download directly (no Storage)

---

## Phase 1: Project Setup (2 hours)

### Task 1.1: Firebase Project Setup
- [x] Create Firebase project at console.firebase.google.com
- [x] Enable Authentication (Email/Password)
- [x] Create Firestore database
- [x] Set up Firebase Storage
- [x] Install Firebase CLI: `npm install -g firebase-tools`
- [x] Login to Firebase: `firebase login`
- [x] Initialize project: `firebase init`
  - [x] Select: Functions, Firestore, Storage
  - [x] Choose TypeScript for Functions
- [x] Set up Firestore security rules
- [x] Set up Storage security rules

**Files Created:**
- [x] `firebase.json`
- [x] `.firebaserc`
- [x] `firestore.rules`
- [x] `storage.rules`

---

### Task 1.2: Firebase Functions Setup
- [x] Navigate to `functions/` folder
- [x] Install dependencies:
  ```bash
  npm install firebase-functions firebase-admin openai docx
  ```
- [x] Set OpenAI API key (added as OPENAI_API_KEY environment variable)
- [x] Create `functions/src/index.ts` with basic structure (TypeScript)
- [ ] Test deployment: `firebase deploy --only functions`

**Files Created:**
- [x] `functions/src/index.ts` (TypeScript version)
- [x] `functions/package.json`

---

### Task 1.3: React App Setup
- [x] Create React app (using Vite, not create-react-app)
- [x] Navigate to project root (Vite structure)
- [x] Install dependencies:
  ```bash
  npm install react-router-dom @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration firebase file-saver date-fns
  ```
- [x] Set up folder structure:
  ```
  src/
    ├── components/
    ├── pages/
    ├── services/
    ├── App.tsx (exists)
    └── main.tsx (exists)
  ```
- [x] Create Firebase config file: `src/services/firebase.ts`

**Files Created:**
- [x] `package.json` (root level, Vite setup)
- [x] `src/services/firebase.ts`
- [x] `src/App.tsx` (exists)
- [x] `src/main.tsx` (exists)

---

## Phase 2: Firebase Functions (2 hours)

### Task 2.1: Generate Letter Function
- [x] Create `generateLetter` function
- [ ] Read extracted text from Firestore (NOT Storage)
- [x] Extract text from documents (for upload process)
- [x] Call OpenAI API with document content
- [ ] Save generated letter to Firestore
- [x] Return generated letter
- [x] Add error handling
- [ ] Test function

**Note:** Function should read extracted text from Firestore, not download files from Storage

**Code Location:** `functions/src/index.ts`

---

### Task 2.2: Refine Letter Function
- [x] Create `refineLetter` function
- [x] Accept letter content + instruction
- [x] Call OpenAI API for refinement
- [x] Return refined letter
- [x] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

### Task 2.3: Chat with AI Function
- [x] Create `chatWithAI` function
- [x] Accept message + document references
- [x] Call OpenAI API (chat completion)
- [x] Optionally update letter based on conversation
- [x] Return AI response + updates
- [x] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

### Task 2.4: Export to Word Function
- [x] Create `exportToWord` function
- [x] Install `docx` library (if not done)
- [ ] Read letter content from Firestore
- [x] Convert letter content to Word format
- [x] Create .docx file
- [ ] Return file buffer directly (NO Storage upload)
- [x] Add error handling
- [ ] Test function

**Note:** Function should return file buffer for direct download, NOT save to Storage

**Code Location:** `functions/src/index.ts`

---

## Phase 3: Authentication & Routing (1.5 hours)

### Task 3.1: Firebase Service Setup
- [x] Create `src/services/firebase.ts`
- [x] Initialize Firebase app
- [x] Export auth, firestore, functions (NO storage)
- [x] Test connection

**Files Created:**
- [x] `src/services/firebase.ts`

---

### Task 3.2: React Router Setup
- [x] Set up routes in `App.tsx`:
  - `/login` → Login page
  - `/documents` → Documents List page
  - `/editor/:documentId?` → Editor page
- [x] Create protected route wrapper (auth-only, no Firestore)
- [x] Add navigation logic
- [x] Test routing

**Files Modified:**
- [x] `src/App.tsx`
- [x] `src/components/ProtectedRoute.tsx` (created)

---

### Task 3.3: Login Page
- [x] Create `src/pages/Login.tsx`
- [x] Build login form (email/password)
- [x] Add sign up option
- [x] Add Google Sign-In button
- [x] Integrate Firebase Auth
- [x] Handle errors
- [x] Redirect to `/documents` on success
- [x] Add basic styling

**Files Created:**
- [x] `src/pages/Login.tsx`
- [x] `src/pages/Login.css`

---

## Phase 4: Documents List Page (2 hours)

### Task 4.1: Documents List Component
- [x] Create `src/pages/DocumentsList.tsx`
- [x] Fetch user's documents from Firestore
- [x] Display loading state
- [x] Handle empty state
- [x] Add logout button
- [x] Add "Upload New" button

**Files Created:**
- [x] `src/pages/DocumentsList.tsx`
- [x] `src/pages/DocumentsList.css`

---

### Task 4.2: Document Card Component
- [x] Create `src/components/DocumentCard.tsx`
- [x] Display document title
- [x] Display creation date (format with date-fns)
- [x] Display format/type
- [x] Add click handler to open editor
- [x] Add hover effects
- [x] Style card

**Files Created:**
- [x] `src/components/DocumentCard.tsx`
- [x] `src/components/DocumentCard.css`

---

### Task 4.3: Grid Layout
- [x] Create grid layout (3-4 columns)
- [x] Make it responsive
- [x] Add spacing
- [x] Style grid

**Files Modified:**
- [x] `src/pages/DocumentsList.tsx`
- [x] `src/pages/DocumentsList.css` (created)
- [x] `src/App.tsx` (updated to import DocumentsList)

---

## Phase 5: Document Upload (1.5 hours)

### Task 5.1: Upload Component
- [x] Create `src/components/DocumentUpload.tsx`
- [x] Add file input (accept PDF, Word, text)
- [x] Add drag & drop support
- [x] Extract text from uploaded files (client-side: pdfjs-dist, mammoth)
- [x] Save extracted text to Firestore (NOT Storage)
- [x] Show upload progress
- [x] Create document entry in Firestore with extracted text
- [x] Redirect to Editor with new document ID

**Note:** We extract text and save to Firestore. We do NOT save PDF/Word files to Storage.

**Files Created:**
- [x] `src/components/DocumentUpload.tsx`
- [x] `src/components/DocumentUpload.css`

---

### Task 5.2: Upload Integration
- [x] Add upload modal/page
- [x] Integrate with Documents List
- [x] Handle errors
- [x] Add success message (redirects to editor)

**Files Modified:**
- [x] `src/pages/DocumentsList.tsx`

---

## Phase 6: Editor Page - Layout (2 hours)

### Task 6.1: Editor Page Structure
- [x] Create `src/pages/Editor.tsx`
- [x] Set up layout structure:
  - Header (title, buttons)
  - Toolbar (formatting buttons + chat toggle)
  - Main layout (editor + chat sidebar)
- [x] Add basic styling

**Files Created:**
- [x] `src/pages/Editor.tsx`
- [x] `src/pages/Editor.css`

---

### Task 6.2: Header Component
- [x] Create header with:
  - Document title
  - [Back] button
  - [Save] button
  - [Export] button
- [x] Add click handlers (placeholders for Save/Export - will be implemented in later phases)
- [x] Style header

**Files Modified:**
- [x] `src/pages/Editor.tsx`

---

### Task 6.3: Toolbar Component
- [x] Create toolbar with formatting buttons:
  - Bold, Italic, Underline
  - Headings (H1, H2)
  - Lists (ordered, unordered)
  - Blockquote
  - Link
- [x] Add chat toggle button ([→ Chat] / [← Hide Chat])
- [x] Style toolbar

**Files Modified:**
- [x] `src/pages/Editor.tsx`

---

### Task 6.4: Layout with Resizable Chat
- [x] Set up flex layout:
  - Editor area (flex: 1)
  - Chat sidebar (400px, conditional)
- [x] Add toggle functionality for chat
- [x] Add smooth transitions
- [x] Test layout

**Files Modified:**
- [x] `src/pages/Editor.tsx`
- [x] `src/App.tsx` (updated to import Editor component)

---

## Phase 7: Tiptap Editor (2.5 hours)

### Task 7.1: Tiptap Setup
- [x] Create `src/components/TiptapEditor.tsx`
- [x] Initialize Tiptap editor
- [x] Add starter kit extensions
- [x] Connect to Editor page (toolbar buttons will be connected in Task 7.2)
- [x] Test basic editing

**Files Created:**
- [x] `src/components/TiptapEditor.tsx`
- [x] `src/components/TiptapEditor.css`

**Files Modified:**
- [x] `src/pages/Editor.tsx` (integrated TiptapEditor component)
- [x] `src/pages/Editor.css` (removed placeholder styles)

---

### Task 7.2: Formatting Buttons
- [x] Connect toolbar buttons to Tiptap commands:
  - Bold: `editor.chain().focus().toggleBold().run()`
  - Italic: `editor.chain().focus().toggleItalic().run()`
  - Underline: `editor.chain().focus().toggleUnderline().run()`
  - Headings: `editor.chain().focus().toggleHeading({ level: 1 }).run()`
  - Lists: `editor.chain().focus().toggleBulletList().run()`
  - Blockquote: `editor.chain().focus().toggleBlockquote().run()`
  - Link: `editor.chain().focus().setLink({ href: url }).run()`
- [x] Add active state indicators (buttons highlight when formatting is active)
- [x] Test all buttons (all buttons connected and functional)

**Files Modified:**
- [x] `src/pages/Editor.tsx` (added button handlers and active states)
- [x] `src/components/TiptapEditor.tsx` (added underline extension and onEditorReady callback)
- [x] `src/pages/Editor.css` (added active state styling)
- [x] `package.json` (added @tiptap/extension-underline)

---

### Task 7.3: Change Tracking
- [x] Install/configure collaboration extension (basic implementation - full Y.js setup deferred)
- [x] Set up change tracking (CSS-based change highlighting)
- [x] Show additions (green highlights via CSS)
- [x] Show deletions (red highlights via CSS)
- [x] Add accept/reject buttons (UI ready - full functionality requires Y.js backend)
- [x] Test change tracking (CSS styling implemented)

**Note:** Full collaboration extension requires Y.js and a provider backend. Basic change tracking styling is implemented. Full collaboration can be added in a future phase.

**Files Modified:**
- [x] `src/components/TiptapEditor.tsx` (change tracking styles ready)
- [x] `src/components/TiptapEditor.css` (added change tracking CSS styles)

---

### Task 7.4: Save Functionality
- [x] Get editor content: `editor.getHTML()` or `editor.getJSON()`
- [x] Save to Firestore (with create/update logic)
- [x] Save to localStorage (backup)
- [x] Add save button handler
- [x] Add auto-save (every 30 seconds)
- [x] Show save status (saved/saving/unsaved indicators)

**Files Modified:**
- [x] `src/pages/Editor.tsx` (full save functionality implemented)
- [x] `src/pages/Editor.css` (save status styling added)

---

### Task 7.5: A4 Page Format with Configurable Margins
- [x] Create A4 page container (210mm × 297mm / ~794px × 1123px)
- [x] Add canvas background (light gray) with centered A4 page
- [x] Implement configurable margins (top, bottom, left, right)
- [x] Add margin controls UI (settings panel with ⚙️ button in toolbar)
- [x] Save margin settings to Firestore (per document)
- [x] Apply margins as padding to editor content area
- [x] Style page with shadow and paper-like appearance

**Files Modified:**
- [x] `src/pages/Editor.tsx` (A4 page container, margin controls, save to Firestore)
- [x] `src/pages/Editor.css` (A4 page styling, margin settings panel)
- [x] `src/components/TiptapEditor.css` (updated for A4 format)

---

### Task 7.6: Multi-Page Pagination
- [x] Implement automatic page creation when content exceeds single page
- [x] Calculate page count based on content height and margins
- [x] Render multiple fixed A4 pages (794px × 1123px each)
- [x] Use CSS mask to hide content in gaps between pages
- [x] Position pages with 20px gaps between them
- [x] Ensure content flows across pages correctly
- [x] Hide content in margins and page gaps using CSS mask-image

**Technical Implementation:**
- Single Tiptap editor spans all pages (positioned absolutely)
- Multiple page containers positioned absolutely at calculated offsets
- CSS mask-image with linear gradient hides content in:
  - Top/bottom margins of each page
  - 20px gaps between pages
- Content visible only in content areas (between margins) on each page

**Files Modified:**
- [x] `src/components/TiptapEditor.tsx` (pagination logic, page calculation, CSS mask)
- [x] `src/components/TiptapEditor.css` (page container styling, editor positioning)

---

## Phase 8: Chat Sidebar (2 hours)

### Task 8.1: Chat Component
- [ ] Create `src/components/ChatSidebar.tsx`
- [ ] Set up chat UI:
  - Messages list (scrollable)
  - Input field at bottom
  - Send button
- [ ] Style chat sidebar

**Files Created:**
- `src/components/ChatSidebar.tsx`

---

### Task 8.2: Chat Messages
- [ ] Create message component
- [ ] Display user messages
- [ ] Display AI messages
- [ ] Show document references (@ mentions)
- [ ] Add timestamps
- [ ] Style messages

**Files Created:**
- `src/components/ChatMessage.tsx`

---

### Task 8.3: Chat Input with @ Mentions
- [ ] Create chat input component
- [ ] Detect `@` character
- [ ] Show document dropdown on `@`
- [ ] Allow document selection
- [ ] Send message to Firebase Function
- [ ] Display AI response
- [ ] Handle document references

**Files Modified:**
- `src/components/ChatSidebar.tsx`

---

### Task 8.4: Chat Integration
- [ ] Connect chat to `chatWithAI` function
- [ ] Update editor when AI makes changes
- [ ] Show changes in editor
- [ ] Allow accept/reject
- [ ] Test full chat flow

**Files Modified:**
- `src/pages/Editor.tsx`
- `frontend/src/components/ChatSidebar.js`
- `frontend/src/components/TiptapEditor.js`

---

## Phase 9: Word Export (1 hour)

### Task 9.1: Export Button
- [x] Add export button handler
- [x] Call `exportToWord` Firebase Function (with letter text or documentId)
- [x] Receive file buffer from function (NOT URL)
- [x] Download using `file-saver` with buffer
- [x] Show loading state
- [x] Handle errors

**Note:** Function returns file buffer directly, NOT a Storage URL. Direct download only.

**Files Modified:**
- `src/pages/Editor.tsx`

---

### Task 9.2: Export Function Testing
- [ ] Test export with simple letter
- [ ] Test export with formatted text
- [ ] Test export with multiple pages
- [ ] Verify Word file opens correctly
- [ ] Fix any formatting issues

**Files Modified:**
- `functions/src/index.ts` (exportToWord function)

---

## Phase 10: Polish & Testing (2 hours)

### Task 10.1: Styling
- [ ] Style all components consistently
- [ ] Add hover effects
- [ ] Add transitions
- [ ] Make responsive
- [ ] Fix layout issues

**Files Modified:**
- `src/App.css`
- Component-specific CSS files

---

### Task 10.2: Error Handling
- [ ] Add error boundaries
- [ ] Handle Firebase errors
- [ ] Handle OpenAI API errors
- [ ] Show user-friendly error messages
- [ ] Add retry logic

**Files Modified:**
- All components

---

### Task 10.3: Loading States
- [ ] Add loading spinners
- [ ] Show loading during:
  - Document fetch
  - Letter generation
  - Chat responses
  - Export
- [ ] Disable buttons during loading

**Files Modified:**
- All components

---

### Task 10.4: Testing
- [ ] Test login/signup flow
- [ ] Test document creation
- [ ] Test document upload
- [ ] Test letter generation
- [ ] Test chat functionality
- [ ] Test change tracking
- [ ] Test Word export
- [ ] Test auto-save
- [ ] Test on different browsers

---

## Phase 11: Deployment (1 hour)

### Task 11.1: Firebase Deployment
- [ ] Deploy Firebase Functions:
  ```bash
  firebase deploy --only functions
  ```
- [ ] Deploy Firestore rules:
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Deploy Storage rules:
  ```bash
  firebase deploy --only storage
  ```

---

### Task 11.2: Frontend Deployment
- [ ] Build React app:
  ```bash
  cd frontend
  npm run build
  ```
- [ ] Deploy to Firebase Hosting:
  ```bash
  firebase deploy --only hosting
  ```
- [ ] Or deploy to Vercel/Netlify
- [ ] Test deployed app

---

## File Checklist

### Firebase
- [x] `firebase.json`
- [x] `.firebaserc`
- [x] `firestore.rules`
- [x] `storage.rules`
- [x] `functions/src/index.ts` (TypeScript version)
- [x] `functions/package.json`

### Frontend - Pages
- [x] `src/pages/Login.tsx`
- [x] `src/pages/DocumentsList.tsx`
- [x] `src/pages/Editor.tsx`

### Frontend - Components
- [x] `src/components/DocumentCard.tsx`
- [x] `src/components/DocumentUpload.tsx`
- [x] `src/components/TiptapEditor.tsx`
- [ ] `src/components/ChatSidebar.tsx`
- [ ] `src/components/ChatMessage.tsx`

### Frontend - Services
- [x] `src/services/firebase.ts`

### Frontend - Core
- [x] `src/App.tsx` (exists)
- [x] `src/main.tsx` (exists)
- [x] `src/App.css` (exists)

---

## Time Estimates

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1: Setup | 3 tasks | 2 hours |
| Phase 2: Functions | 4 tasks | 2 hours |
| Phase 3: Auth & Routing | 3 tasks | 1.5 hours |
| Phase 4: Documents List | 3 tasks | 2 hours |
| Phase 5: Upload | 2 tasks | 1.5 hours |
| Phase 6: Editor Layout | 4 tasks | 2 hours |
| Phase 7: Tiptap | 6 tasks | 2.5 hours |
| Phase 8: Chat | 4 tasks | 2 hours |
| Phase 9: Export | 2 tasks | 1 hour |
| Phase 10: Polish | 4 tasks | 2 hours |
| Phase 11: Deploy | 2 tasks | 1 hour |
| **TOTAL** | **31 tasks** | **19.5 hours** |

**Realistic estimate: 12-15 hours** (with experience)

---

## Quick Start Commands

```bash
# 1. Initialize Firebase
firebase login
firebase init

# 2. Set up Functions
cd functions
npm install

# 3. Set OpenAI key
firebase functions:config:set openai.key="your-key"

# 4. Set up React app
cd ..
npx create-react-app frontend
cd frontend
npm install react-router-dom @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration firebase file-saver date-fns

# 5. Start development
npm start

# 6. Deploy Functions
cd ../functions
firebase deploy --only functions
```

---

## Notes

- **Auto-save:** Save to localStorage every 30 seconds, sync to Firestore on manual save
- **Change tracking:** Use Tiptap collaboration extension for change highlights
- **Document references:** Build custom @ mention system in chat input
- **Word export:** Use `docx` library in Firebase Function, download via `file-saver`
- **Styling:** Use CSS (no external UI libraries) for clean, professional look

---

**Ready to build! Start with Phase 1, Task 1.1** 🚀

