# System Patterns: Themis

## Architecture Overview

Themis follows a **client-server architecture** with Firebase as the backend platform:

```
┌─────────────────┐
│  React Frontend │  (TypeScript + Vite)
│  - Tiptap Editor│
│  - Chat UI      │
│  - Document Mgmt│
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼─────────────────────────┐
│         Firebase Platform         │
│  ┌──────────┐  ┌──────────────┐  │
│  │ Auth     │  │  Firestore   │  │
│  └──────────┘  │  (Database)  │  │
│  ┌──────────┐  └──────────────┘  │
│  │ Storage  │  ┌──────────────┐  │
│  └──────────┘  │  Functions   │  │
│                │  (Backend)   │  │
│                └──────────────┘  │
└──────────────────────────────────┘
         │
         │ API Calls
         │
┌────────▼────────┐
│   OpenAI API    │
│  (AI Generation)│
└─────────────────┘
```

## Key Technical Decisions

### Frontend Framework
- **React 19** with **TypeScript** for type safety
- **Vite** for fast development and optimized builds
- **React Router** for client-side navigation

### Backend Platform
- **Firebase** for complete backend-as-a-service:
  - **Authentication:** Email/password auth
  - **Firestore:** NoSQL database for documents and metadata
  - **Storage:** File storage for uploaded documents
  - **Functions:** Serverless functions for AI operations

### Rich Text Editing
- **Tiptap** for rich text editing capabilities
- **Starter Kit** for core formatting features
- **Collaboration Extension** for change tracking

### AI Integration
- **OpenAI API** (via Firebase Functions) for:
  - Document analysis and letter generation
  - Letter refinement based on user instructions
  - Chat-based interactions

## Design Patterns

### Component Structure

```
src/
├── pages/           # Route-level components
│   ├── Login.tsx
│   ├── DocumentsList.tsx
│   └── Editor.tsx
├── components/      # Reusable UI components
│   ├── DocumentCard.tsx
│   ├── DocumentUpload.tsx
│   ├── TiptapEditor.tsx
│   ├── ChatSidebar.tsx
│   └── ChatMessage.tsx
├── services/        # External service integrations
│   └── firebase.ts
└── App.tsx         # Root component with routing
```

### Data Flow Patterns

#### Document Generation Flow
```
User Upload → Firebase Storage → Firestore Metadata
    ↓
User Clicks "Generate" → Firebase Function
    ↓
Function Reads Documents → OpenAI API
    ↓
Generated Letter → Firestore → Editor Display
```

#### Save Flow
```
Editor Change → Tiptap State Update
    ↓
Auto-save (30s) → Firestore Update
    ↓
Manual Save → Firestore Update + Confirmation
```

#### Export Flow
```
User Clicks Export → Firebase Function
    ↓
Function: Letter Text → docx Library
    ↓
Word Document → Firebase Storage
    ↓
Download URL → file-saver → User Download
```

### State Management

- **Local Component State:** React hooks (`useState`, `useEffect`)
- **Firestore Real-time:** `onSnapshot` for live document updates
- **Editor State:** Tiptap editor instance manages its own state
- **Auth State:** Firebase Auth listener for user session

### Security Patterns

- **Authentication:** Firebase Auth with email/password
- **Authorization:** Firestore security rules based on `userId`
- **Data Isolation:** Users can only access their own documents
- **API Keys:** Stored securely in Firebase Functions config
- **File Access:** Storage rules restrict access to authenticated users

## Component Relationships

### Editor Page Architecture
```
Editor.tsx (Page)
├── Header Component
│   ├── Title
│   ├── Back Button
│   ├── Save Button
│   └── Export Button
├── Toolbar Component
│   ├── Formatting Buttons (Bold, Italic, etc.)
│   └── Chat Toggle Button
├── Main Layout (Flex)
│   ├── TiptapEditor.tsx (flex: 1)
│   └── ChatSidebar.tsx (400px, conditional)
│       ├── ChatMessage.tsx (multiple)
│       └── ChatInput.tsx
```

### Documents List Architecture
```
DocumentsList.tsx (Page)
├── Header
│   ├── Title
│   ├── Logout Button
│   └── Upload New Button
└── Grid Layout
    └── DocumentCard.tsx (multiple)
        ├── Title
        ├── Creation Date
        └── Format/Type
```

## Data Models

### Firestore Collections

#### `documents` Collection
```typescript
{
  id: string;
  title: string;
  content: string | null;  // HTML from Tiptap
  format: string;          // "Standard", "Personal Injury", etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  sourceDocumentIds: string[];  // References to uploaded files
  status: "draft" | "completed";
}
```

#### `sourceDocuments` Collection
```typescript
{
  id: string;
  name: string;
  url: string;            // Firebase Storage URL
  uploadedAt: Timestamp;
  documentId: string;     // Parent document reference
  userId: string;
}
```

### Firebase Functions

#### `generateLetter`
- **Input:** `{ documentIds: string[] }`
- **Output:** `{ letter: string }`
- **Process:** Read documents → Extract text → Call OpenAI → Return letter

#### `refineLetter`
- **Input:** `{ letter: string, instruction: string }`
- **Output:** `{ letter: string }`
- **Process:** Send to OpenAI with refinement prompt → Return updated letter

#### `chatWithAI`
- **Input:** `{ message: string, documentIds?: string[] }`
- **Output:** `{ response: string, updates?: { letter: string } }`
- **Process:** Chat completion with context → Return response and optional updates

#### `exportToWord`
- **Input:** `{ letter: string, title: string }`
- **Output:** `{ fileUrl: string }`
- **Process:** Convert to .docx → Upload to Storage → Return URL

## Key Patterns

### Error Handling
- Try-catch blocks in all async operations
- User-friendly error messages
- Retry logic for network failures
- Error boundaries for React components

### Loading States
- Spinner components during async operations
- Disabled buttons during processing
- Progress indicators for file uploads
- Skeleton screens for data loading

### Real-time Updates
- Firestore `onSnapshot` for live document sync
- Optimistic UI updates
- Conflict resolution for concurrent edits

### Performance Optimization
- Lazy loading for routes
- Debounced auto-save
- Image optimization for uploads
- Code splitting with Vite

## Integration Points

### Firebase Services
- **Auth:** User authentication and session management
- **Firestore:** Document storage and real-time sync
- **Storage:** File uploads and downloads
- **Functions:** Serverless backend operations

### External APIs
- **OpenAI:** AI-powered text generation and refinement
- **docx Library:** Word document creation (in Functions)

## Future Considerations

- **Scalability:** Firebase handles scaling automatically
- **Collaboration:** Tiptap collaboration extension for multi-user editing
- **Offline Support:** Service workers for offline document access
- **Mobile:** Responsive design supports mobile browsers

