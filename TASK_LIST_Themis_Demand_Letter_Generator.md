# Themis - Task List
## Step-by-Step Build Guide

**Project:** Themis - AI-Powered Demand Letter Generator  
**Tech Stack:** React + Firebase + OpenAI + Tiptap  
**Estimated Time:** 12-15 hours (1.5-2 days)

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
- [ ] Create `generateLetter` function
- [ ] Read source documents from Storage
- [ ] Extract text from documents
- [ ] Call OpenAI API with document content
- [ ] Return generated letter
- [ ] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

### Task 2.2: Refine Letter Function
- [ ] Create `refineLetter` function
- [ ] Accept letter content + instruction
- [ ] Call OpenAI API for refinement
- [ ] Return refined letter
- [ ] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

### Task 2.3: Chat with AI Function
- [ ] Create `chatWithAI` function
- [ ] Accept message + document references
- [ ] Call OpenAI API (chat completion)
- [ ] Optionally update letter based on conversation
- [ ] Return AI response + updates
- [ ] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

### Task 2.4: Export to Word Function
- [ ] Create `exportToWord` function
- [ ] Install `docx` library (if not done)
- [ ] Convert letter content to Word format
- [ ] Create .docx file
- [ ] Upload to Firebase Storage
- [ ] Return download URL
- [ ] Add error handling
- [ ] Test function

**Code Location:** `functions/src/index.ts`

---

## Phase 3: Authentication & Routing (1.5 hours)

### Task 3.1: Firebase Service Setup
- [ ] Create `src/services/firebase.ts`
- [ ] Initialize Firebase app
- [ ] Export auth, firestore, storage, functions
- [ ] Test connection

**Files Created:**
- `src/services/firebase.ts`

---

### Task 3.2: React Router Setup
- [ ] Set up routes in `App.tsx`:
  - `/login` → Login page
  - `/documents` → Documents List page
  - `/editor/:documentId?` → Editor page
- [ ] Create protected route wrapper
- [ ] Add navigation logic
- [ ] Test routing

**Files Modified:**
- `src/App.tsx`

---

### Task 3.3: Login Page
- [ ] Create `src/pages/Login.tsx`
- [ ] Build login form (email/password)
- [ ] Add sign up option
- [ ] Integrate Firebase Auth
- [ ] Handle errors
- [ ] Redirect to `/documents` on success
- [ ] Add basic styling

**Files Created:**
- `src/pages/Login.tsx`

---

## Phase 4: Documents List Page (2 hours)

### Task 4.1: Documents List Component
- [ ] Create `src/pages/DocumentsList.tsx`
- [ ] Fetch user's documents from Firestore
- [ ] Display loading state
- [ ] Handle empty state
- [ ] Add logout button
- [ ] Add "Upload New" button

**Files Created:**
- `src/pages/DocumentsList.tsx`

---

### Task 4.2: Document Card Component
- [ ] Create `src/components/DocumentCard.tsx`
- [ ] Display document title
- [ ] Display creation date (format with date-fns)
- [ ] Display format/type
- [ ] Add click handler to open editor
- [ ] Add hover effects
- [ ] Style card

**Files Created:**
- `src/components/DocumentCard.tsx`

---

### Task 4.3: Grid Layout
- [ ] Create grid layout (3-4 columns)
- [ ] Make it responsive
- [ ] Add spacing
- [ ] Style grid

**Files Modified:**
- `src/pages/DocumentsList.tsx`
- `src/App.css` (or create separate CSS file)

---

## Phase 5: Document Upload (1.5 hours)

### Task 5.1: Upload Component
- [ ] Create `src/components/DocumentUpload.tsx`
- [ ] Add file input (accept PDF, Word, text)
- [ ] Add drag & drop support
- [ ] Upload files to Firebase Storage
- [ ] Show upload progress
- [ ] Create document entry in Firestore
- [ ] Redirect to Editor with new document ID

**Files Created:**
- `src/components/DocumentUpload.tsx`

---

### Task 5.2: Upload Integration
- [ ] Add upload modal/page
- [ ] Integrate with Documents List
- [ ] Handle errors
- [ ] Add success message

**Files Modified:**
- `src/pages/DocumentsList.tsx`

---

## Phase 6: Editor Page - Layout (2 hours)

### Task 6.1: Editor Page Structure
- [ ] Create `src/pages/Editor.tsx`
- [ ] Set up layout structure:
  - Header (title, buttons)
  - Toolbar (formatting buttons + chat toggle)
  - Main layout (editor + chat sidebar)
- [ ] Add basic styling

**Files Created:**
- `src/pages/Editor.tsx`

---

### Task 6.2: Header Component
- [ ] Create header with:
  - Document title
  - [Back] button
  - [Save] button
  - [Export] button
- [ ] Add click handlers
- [ ] Style header

**Files Modified:**
- `src/pages/Editor.tsx`

---

### Task 6.3: Toolbar Component
- [ ] Create toolbar with formatting buttons:
  - Bold, Italic, Underline
  - Headings (H1, H2)
  - Lists (ordered, unordered)
  - Blockquote
  - Link
- [ ] Add chat toggle button ([→ Chat] / [← Hide Chat])
- [ ] Style toolbar

**Files Modified:**
- `src/pages/Editor.tsx`

---

### Task 6.4: Layout with Resizable Chat
- [ ] Set up flex layout:
  - Editor area (flex: 1)
  - Chat sidebar (400px, conditional)
- [ ] Add toggle functionality for chat
- [ ] Add smooth transitions
- [ ] Test layout

**Files Modified:**
- `src/pages/Editor.tsx`
- `frontend/src/App.css`

---

## Phase 7: Tiptap Editor (2.5 hours)

### Task 7.1: Tiptap Setup
- [ ] Create `src/components/TiptapEditor.tsx`
- [ ] Initialize Tiptap editor
- [ ] Add starter kit extensions
- [ ] Connect to toolbar buttons
- [ ] Test basic editing

**Files Created:**
- `src/components/TiptapEditor.tsx`

---

### Task 7.2: Formatting Buttons
- [ ] Connect toolbar buttons to Tiptap commands:
  - Bold: `editor.chain().focus().toggleBold().run()`
  - Italic: `editor.chain().focus().toggleItalic().run()`
  - Underline: `editor.chain().focus().toggleUnderline().run()`
  - Headings: `editor.chain().focus().toggleHeading({ level: 1 }).run()`
  - Lists: `editor.chain().focus().toggleBulletList().run()`
  - Blockquote: `editor.chain().focus().toggleBlockquote().run()`
  - Link: `editor.chain().focus().setLink({ href: url }).run()`
- [ ] Add active state indicators
- [ ] Test all buttons

**Files Modified:**
- `src/pages/Editor.tsx`
- `frontend/src/components/TiptapEditor.js`

---

### Task 7.3: Change Tracking
- [ ] Install/configure collaboration extension
- [ ] Set up change tracking
- [ ] Show additions (green highlights)
- [ ] Show deletions (red highlights)
- [ ] Add accept/reject buttons
- [ ] Test change tracking

**Files Modified:**
- `src/components/TiptapEditor.tsx`

---

### Task 7.4: Save Functionality
- [ ] Get editor content: `editor.getHTML()` or `editor.getJSON()`
- [ ] Save to Firestore
- [ ] Save to localStorage (backup)
- [ ] Add save button handler
- [ ] Add auto-save (every 30 seconds)
- [ ] Show save status

**Files Modified:**
- `src/pages/Editor.tsx`
- `frontend/src/components/TiptapEditor.js`

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
- [ ] Add export button handler
- [ ] Call `exportToWord` Firebase Function
- [ ] Get file URL
- [ ] Download using `file-saver`
- [ ] Show loading state
- [ ] Handle errors

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
- [ ] `src/pages/Login.tsx`
- [ ] `src/pages/DocumentsList.tsx`
- [ ] `src/pages/Editor.tsx`

### Frontend - Components
- [ ] `src/components/DocumentCard.tsx`
- [ ] `src/components/DocumentUpload.tsx`
- [ ] `src/components/TiptapEditor.tsx`
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
| Phase 7: Tiptap | 4 tasks | 2.5 hours |
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

