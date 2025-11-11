# Steno Demand Letter Generator - Implementation Plan

**Tech Stack:** React + Firebase (Auth, Functions, Firestore) + OpenAI

**Note:** Firebase Storage is NOT used. We only use Firestore to store extracted text and letter content.

**Libraries:**
- `react-router-dom` - Routing/navigation
- `docx` - Create Word documents with formatting
- `file-saver` - Download files
- `date-fns` - Date formatting
- `firebase/auth` - Authentication

---

## Project Structure

```
steno-demand-letters/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DocumentCard.js
│   │   │   ├── DocumentList.js
│   │   │   ├── DocumentUpload.js
│   │   │   ├── LetterEditor.js
│   │   │   ├── RefinementPanel.js
│   │   │   └── ExportButton.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── DocumentsList.js
│   │   │   └── Editor.js
│   │   ├── services/
│   │   │   └── firebase.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── functions/
│   ├── index.js
│   ├── package.json
│   └── .env (for OpenAI key)
│
└── firebase.json
```

---

## Updated User Flow

```
1. User visits website
   ↓
2. Login Page (Firebase Auth)
   ↓
3. After login → Documents List Page
   ↓
4. User sees grid of document templates
   - Title
   - Creation date
   - Format/type
   ↓
5. User can:
   A) Click existing document → Open in Editor
   B) Click "Upload New" → Upload flow
   ↓
6. Editor Page:
   - Edit existing letter OR
   - Generate from uploaded documents
   - Refine, export, etc.
```

---

## Build Path - Step by Step

### STEP 1: Firebase Setup & Configuration

**What we'll do:**
1. Initialize Firebase project
2. Set up Firebase Functions
3. Configure Firestore database
4. Add OpenAI API key to Firebase config

**How it will work:**
- Firebase project created in console
- Functions folder ready for code
- Firestore rules configured
- OpenAI key stored securely in Firebase config

**Note:** Firebase Storage is NOT used. All data (extracted text, letters) is stored in Firestore only.

**Files created:**
- `firebase.json`
- `functions/index.js`
- `functions/package.json`

---

### STEP 2: Firebase Functions - Generate Letter

**What we'll build:**
- Cloud Function that calls OpenAI API
- Takes extracted text from Firestore
- Returns generated demand letter
- Saves letter to Firestore

**How it will look:**
```javascript
// Function signature
generateLetter({ documentIds: ['doc1', 'doc2'] })
  → Returns: { letter: "Generated letter text..." }
  → Also saves letter to Firestore
```

**What we'll create:**
- `functions/index.js` with `generateLetter` function
- Error handling
- OpenAI integration
- Firestore read/write

**Before we code, here's the flow:**
1. Frontend calls function with document IDs (from Firestore)
2. Function reads extracted text from Firestore (NOT Storage)
3. Function calls OpenAI with extracted text
4. Function saves generated letter to Firestore
5. Function returns generated letter
6. Frontend receives and displays letter

---

### STEP 3: React App Setup & Routing

**What we'll do:**
1. Create React app
2. Install Firebase SDK
3. Install `react-router-dom` for routing
4. Configure Firebase connection
5. Set up routes: Login → DocumentsList → Editor

**How it will look:**
- Clean React app structure
- Firebase initialized in `services/firebase.js`
- Routes configured in App.js
- Protected routes (require login)

**Files created:**
- `frontend/src/services/firebase.js`
- `frontend/src/App.js` (with routes)
- `frontend/src/index.js`
- `frontend/src/pages/Login.js`
- `frontend/src/pages/DocumentsList.js`
- `frontend/src/pages/Editor.js`

**Libraries to install:**
```bash
npm install react-router-dom firebase date-fns file-saver
```

---

### STEP 4: Login Page

**What we'll build:**
- Firebase Authentication UI
- Email/password login
- Sign up option
- Redirect to documents list after login

**How it will look visually:**
```
┌─────────────────────────────────────┐
│  Steno Demand Letter Generator      │
├─────────────────────────────────────┤
│                                     │
│         [Logo/Title]                │
│                                     │
│  Email:                             │
│  ┌───────────────────────────────┐ │
│  │ user@example.com              │ │
│  └───────────────────────────────┘ │
│                                     │
│  Password:                          │
│  ┌───────────────────────────────┐ │
│  │ ••••••••                      │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Login]                            │
│                                     │
│  Don't have an account?             │
│  [Sign Up]                          │
│                                     │
└─────────────────────────────────────┘
```

**What we'll create:**
- `Login.js` page component
- Firebase Auth integration
- Form validation
- Error handling

**Before we code, here's the flow:**
1. User enters email/password
2. Firebase Auth validates
3. On success → redirect to DocumentsList
4. On error → show error message

---

### STEP 5: Documents List Page

**What we'll build:**
- Grid view of document templates
- Each card shows: title, creation date, format
- "Upload New" button
- Click card to open in editor

**How it will look visually:**
```
┌─────────────────────────────────────────────────────┐
│  My Documents                    [Logout] [Upload New]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Contract │  │ Personal │  │ Business │         │
│  │ Breach   │  │ Injury   │  │ Dispute  │         │
│  │          │  │          │  │          │         │
│  │ Created: │  │ Created: │  │ Created: │         │
│  │ Jan 15   │  │ Jan 10   │  │ Jan 5    │         │
│  │          │  │          │  │          │         │
│  │ Format:  │  │ Format:  │  │ Format:  │         │
│  │ Standard │  │ Standard │  │ Standard │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Property │  │ Employment│ │ [Upload] │         │
│  │ Damage   │  │ Dispute   │ │   New    │         │
│  │          │  │          │  │          │         │
│  │ Created: │  │ Created: │  │          │         │
│  │ Dec 20   │  │ Dec 15   │  │          │         │
│  │          │  │          │  │          │         │
│  │ Format:  │  │ Format:  │  │          │         │
│  │ Standard │  │ Standard │  │          │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**What we'll create:**
- `DocumentsList.js` page component
- `DocumentCard.js` component (reusable card)
- Grid layout (CSS Grid or Flexbox)
- Fetch documents from Firestore
- Click handler to open editor

**Before we code, here's the flow:**
1. User lands on page after login
2. Fetch user's documents from Firestore
3. Display in grid (3-4 columns, multiple rows)
4. Click card → Navigate to Editor with document ID
5. Click "Upload New" → Show upload modal/page

---

### STEP 6: Document Upload Component

**What we'll build:**
- File upload interface
- Extract text from uploaded files
- Save extracted text to Firestore
- Show uploaded documents list

**How it will look visually:**
```
┌─────────────────────────────────────┐
│  Document Upload                    │
├─────────────────────────────────────┤
│                                     │
│  [Choose Files] or Drag & Drop      │
│                                     │
│  Uploaded Documents:                │
│  ✓ contract.pdf (text extracted)   │
│  ✓ evidence.docx (text extracted)  │
│  ✓ correspondence.txt (extracted)  │
│                                     │
│  [Upload More]                     │
└─────────────────────────────────────┘
```

**What we'll create:**
- `DocumentUpload.js` component
- File input with drag & drop
- Text extraction (client-side or via function)
- Upload progress indicator
- List of uploaded documents with extracted text

**Before we code, here's the flow:**
1. User clicks "Upload New" button
2. Modal or new page opens
3. User selects files (PDF, Word, text)
4. Extract text from files (client-side or call function)
5. Save extracted text to Firestore (NOT Storage)
6. Create new document entry in Firestore with extracted text
7. Redirect to Editor with new document ID
8. OR: Show in DocumentsList after upload

**Important:** We do NOT save PDF/Word files to Storage. Only extracted text goes to Firestore.

---

### STEP 7: Editor Page (Two Modes)

**What we'll build:**
- Editor page with two modes:
  - **Mode A:** Open existing document (edit old letter)
  - **Mode B:** New document from upload (generate new letter)

**How it will look visually:**
```
┌─────────────────────────────────────────────────────┐
│  Editor - Contract Breach Demand Letter  [Back] [Save]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  Mode A (Existing):                                │
│  ┌───────────────────────────────────────────────┐ │
│  │ [Letter Editor - shows existing content]      │ │
│  │                                               │ │
│  │ "Dear [Recipient],                           │ │
│  │                                                │ │
│  │  [Existing letter text...]                   │ │
│  │                                                │ │
│  │  [User can edit]                              │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  Mode B (New from Upload):                         │
│  Documents: 3 files uploaded                       │
│  [✨ Generate Demand Letter]                       │
│  ⏳ Generating...                                   │
│  ┌───────────────────────────────────────────────┐ │
│  │ [Generated letter appears here]               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Refinement Panel]                                │
│  [Export to Word]                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**What we'll create:**
- `Editor.js` page component
- Detect mode: existing document ID or new upload
- Load existing letter OR show generate button
- LetterEditor component (same for both modes)

**Before we code, here's the flow:**
- **Mode A (Existing):**
  1. User clicks document card
  2. Navigate to Editor with document ID
  3. Load letter from Firestore
  4. Show in editor (editable)
  
- **Mode B (New):**
  1. User uploads documents
  2. Navigate to Editor with new document ID
  3. Show "Generate Letter" button
  4. User clicks → Generate → Show in editor

---

### STEP 8: Letter Editor Component

**What we'll build:**
- Text editor for the letter
- Save functionality
- Auto-save to Firestore

**How it will look visually:**
```
┌─────────────────────────────────────┐
│  Letter Editor                       │
│  [Save] [Auto-save: ON]             │
├─────────────────────────────────────┤
│                                     │
│  [Large text area - editable]      │
│                                     │
│  "Dear [Recipient],                 │
│                                     │
│   This letter is in regard to...    │
│                                     │
│   [User can edit all text]          │
│                                     │
│   Sincerely,                        │
│   [Attorney Name]"                  │
│                                     │
└─────────────────────────────────────┘
```

**What we'll create:**
- `LetterEditor.js` component
- Textarea or rich text editor
- Save button
- Auto-save every 30 seconds

**Before we code, here's the flow:**
1. Letter displayed in textarea
2. User edits text
3. Changes auto-saved to Firestore
4. Manual save button also available

---

### STEP 9: Refinement Panel

**What we'll build:**
- Input field for refinement instructions
- Refine button
- Updated letter display

**How it will look visually:**
```
┌─────────────────────────────────────┐
│  Refine Letter                      │
├─────────────────────────────────────┤
│  Instructions:                      │
│  ┌───────────────────────────────┐ │
│  │ Make it more formal           │ │
│  └───────────────────────────────┘ │
│  [Refine Letter]                    │
│                                     │
│  Examples:                          │
│  • "Make it more formal"            │
│  • "Add section about damages"      │
│  • "Make it shorter"                │
└─────────────────────────────────────┘
```

**What we'll create:**
- `RefinementPanel.js` component
- Text input for instructions
- Refine button
- Loading state during refinement

**Before we code, here's the flow:**
1. User types instruction (e.g., "Make it more formal")
2. Clicks "Refine"
3. Frontend calls Firebase Function with letter + instruction
4. Function calls OpenAI to refine
5. Updated letter replaces current letter

---

### STEP 10: Word Export Function

**What we'll build:**
- Firebase Function to convert letter to Word
- Export button in frontend
- Download .docx file with proper formatting

**Libraries we'll use:**
- `docx` - Create Word documents with formatting (in Firebase Function)
- `file-saver` - Download files from browser (in React)

**How it will look visually:**
```
┌─────────────────────────────────────┐
│  Letter Editor                       │
│  [Save] [Export to Word]            │
│                                     │
│  [Letter content...]                │
│                                     │
│  Clicking "Export to Word":         │
│  ⏳ Generating Word document...     │
│  → Downloads: demand-letter-2024-01-15.docx│
└─────────────────────────────────────┘
```

**How it will work:**
```javascript
// In Firebase Function (uses docx library)
const { Document, Packer, Paragraph } = require('docx');

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ text: letterContent })
    ]
  }]
});

const blob = await Packer.toBlob(doc);
// Upload to Storage, return URL
```

```javascript
// In React (uses file-saver)
import { saveAs } from 'file-saver';

// Call Firebase Function, get file URL
const fileUrl = await exportToWord({ letter });
saveAs(fileUrl, `demand-letter-${date}.docx`);
```

**What we'll create:**
- Firebase Function `exportToWord` (uses `docx` library)
- Frontend export button component
- Proper file naming: `demand-letter-YYYY-MM-DD.docx`
- Formatted Word document with proper structure

**Before we code, here's the flow:**
1. User clicks "Export to Word" button
2. Frontend calls Firebase Function with letter text (or documentId to read from Firestore)
3. Function reads letter from Firestore (if documentId provided)
4. Function creates formatted .docx using `docx` library
5. Function returns file buffer directly (NO Storage upload)
6. Frontend receives file buffer
7. Frontend triggers download using `file-saver` library
8. File downloads with proper name: `demand-letter-2024-01-15.docx`

**Important:** We do NOT save exported Word files to Storage. Direct download only.

---

## Complete User Flow

### Flow A: Open Existing Document
```
1. User visits website
   ↓
2. Login Page
   ↓
3. Documents List Page (grid of documents)
   ↓
4. User clicks existing document card
   ↓
5. Editor Page opens with existing letter
   ↓
6. User edits letter
   ↓
7. (Optional) User refines with instructions
   ↓
8. User exports to Word
   ↓
9. Downloads .docx file
```

### Flow B: Upload New Document
```
1. User visits website
   ↓
2. Login Page
   ↓
3. Documents List Page
   ↓
4. User clicks "Upload New"
   ↓
5. Upload modal/page opens
   ↓
6. User uploads documents (PDF/Word/text)
   ↓
7. Editor Page opens (new document)
   ↓
8. User clicks "Generate Letter"
   ↓
9. AI generates draft letter
   ↓
10. User edits letter in editor
   ↓
11. (Optional) User refines with instructions
   ↓
12. User exports to Word
   ↓
13. Downloads .docx file
   ↓
14. Document saved to Documents List
```

---

## Firebase Functions We'll Create

### 1. `generateLetter`
**Input:** `{ documentIds: ['id1', 'id2'] }`  
**Output:** `{ letter: "Generated text..." }`  
**What it does:** Reads documents, calls OpenAI, returns letter

### 2. `refineLetter`
**Input:** `{ letter: "...", instruction: "Make it more formal" }`  
**Output:** `{ letter: "Refined text..." }`  
**What it does:** Sends letter + instruction to OpenAI, returns refined version

### 3. `exportToWord`
**Input:** `{ letter: "..." }` or `{ documentId: "..." }`  
**Output:** `{ fileBuffer: Buffer, fileName: "..." }`  
**What it does:** Reads letter from Firestore, creates .docx file, returns file buffer for direct download (NO Storage)

---

## Firestore Collections

**Note:** These old collection structures are replaced by the updated structure below.

### `documents` (Stores all user documents)
```javascript
{
  id: "doc123",
  title: "Contract Breach Demand Letter",
  content: "Letter text...", // Generated letter content
  format: "Standard", // or "Personal Injury", "Business", etc.
  createdAt: timestamp,
  updatedAt: timestamp,
  userId: "user123",
  sourceDocumentIds: ["doc1", "doc2"], // References to source documents
  status: "draft" | "completed"
}
```

### `sourceDocuments` (Extracted text from uploaded files)
```javascript
{
  id: "sourcedoc123",
  name: "contract.pdf",
  extractedText: "Full text extracted from PDF...", // Extracted text, NOT file URL
  uploadedAt: timestamp,
  documentId: "doc123", // links to parent document
  userId: "user123"
}
```

**Important:** 
- We store extracted text in Firestore, NOT file URLs
- We do NOT use Firebase Storage for uploaded files
- All data is in Firestore only

---

## Build Order

1. **Firebase Setup** (30 min)
   - Project, Functions, Firestore, Storage, Auth
2. **Firebase Functions** (1.5 hours)
   - generateLetter, refineLetter, exportToWord
3. **React App Setup** (30 min)
   - App, routing, Firebase SDK
4. **Login Page** (1 hour)
   - Firebase Auth integration
5. **Documents List Page** (2 hours)
   - Grid layout, DocumentCard component
   - Fetch from Firestore
   - Navigation to Editor
6. **Document Upload** (1.5 hours)
   - Upload modal/page
   - Firebase Storage integration
7. **Editor Page** (2 hours)
   - Two modes: existing vs new
   - LetterEditor component
8. **Refinement Panel** (1 hour)
   - Instruction input, refine function
9. **Word Export** (1 hour)
   - docx library integration
10. **Styling & Polish** (1.5 hours)
    - Grid layout, cards, forms
    - Responsive design

**Total: ~12-13 hours (one full day)**

---

## Next Steps

Before we start building each component, I'll:
1. Show you exactly what it will look like
2. Explain the steps we'll take
3. Show the code structure
4. Then we build it together

Ready to start with Step 1: Firebase Setup?

