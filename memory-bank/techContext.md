# Technical Context: Themis

## Technology Stack

### Frontend
- **React 19.2.0** - UI framework
- **TypeScript 5.9.3** - Type safety
- **Vite 7.2.2** - Build tool and dev server
- **React Router DOM** - Client-side routing
- **Tiptap** - Rich text editor
  - `@tiptap/react` - React integration
  - `@tiptap/starter-kit` - Core extensions
  - `@tiptap/extension-collaboration` - Change tracking
- **date-fns** - Date formatting utilities
- **file-saver** - File download functionality

### Backend (Firebase)
- **Firebase Authentication** - User management
- **Cloud Firestore** - NoSQL database (stores extracted text and letters)
- **Cloud Functions** - Serverless backend
  - **Node.js 22** runtime
  - **OpenAI SDK** - AI integration
  - **docx** - Word document generation
  - **firebase-admin** - Admin SDK
- **Note:** Firebase Storage is NOT used. All data stored in Firestore only.

### AI Services
- **OpenAI API** - Text generation, refinement, and document analysis
  - **GPT-4o:** Primary model for document reading and letter generation (uses Files API)
  - **GPT-4o-mini:** Fallback for simple chat without documents
  - **OpenAI Files API:** Upload PDFs to OpenAI for direct reading by gpt-4o
  - **Chat Completion:** Interactive refinement and Q&A with document context
  - **File Processing:** PDFs uploaded with `purpose: 'user_data'` for Chat Completions API

### Development Tools
- **ESLint 9.39.1** - Code linting
- **TypeScript ESLint** - TypeScript-specific linting
- **Vite Plugin React** - React HMR and optimization

## Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase account
- OpenAI API key

### Project Structure
```
Themis/
├── src/                    # React frontend source
│   ├── components/         # Reusable components
│   ├── pages/              # Route components
│   ├── services/           # Firebase integration
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── functions/              # Firebase Functions (to be created)
│   ├── index.js            # Function definitions
│   └── package.json         # Function dependencies
├── public/                 # Static assets
├── memory-bank/            # Project documentation
├── package.json            # Frontend dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite configuration
└── firebase.json            # Firebase config (to be created)
```

### Installation Commands

```bash
# Frontend dependencies
npm install react-router-dom @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-collaboration firebase file-saver date-fns

# Firebase Functions dependencies (when created)
cd functions
npm install firebase-functions firebase-admin openai docx
```

## Configuration Files

### TypeScript Configuration
- `tsconfig.json` - Main TypeScript config
- `tsconfig.app.json` - App-specific config
- `tsconfig.node.json` - Node.js config (for Vite)

### Vite Configuration
- `vite.config.ts` - Build and dev server settings
- React plugin configured for HMR

### ESLint Configuration
- `eslint.config.js` - Linting rules
- TypeScript-aware linting enabled

## Firebase Setup Requirements

### Firebase Project Configuration
1. Create Firebase project in console (themis-law)
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Initialize Functions
5. Configure OpenAI secret in Functions

### Security Rules

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{documentId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    match /sourceDocuments/{sourceId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

**Note:** Firebase Storage is NOT used in this project. Storage rules exist but are not needed.

### Environment Variables
- OpenAI API key stored in Firebase Functions secrets:
  ```bash
  firebase functions:secrets:set OPENAI_API_KEY
  ```
- For local development: `.env` file in `functions/` directory with `OPENAI_API_KEY`

## Development Workflow

### Local Development
```bash
# Start frontend dev server
npm run dev

# Start Firebase emulators (when configured)
firebase emulators:start
```

### Build Process
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment
```bash
# Deploy Firebase Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy frontend (if using Firebase Hosting)
firebase deploy --only hosting
```

## Technical Constraints

### Performance Requirements
- HTTP request/response time: < 5 seconds
- Database queries: < 2 seconds
- File uploads: Progress tracking required
- Real-time updates: < 1 second latency

### Security Requirements
- Data encryption for documents and communications
- Compliance with legal industry standards
- User data isolation (users can only access their own documents)
- Secure API key storage

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features required
- No IE11 support

### Scalability Considerations
- Firebase handles automatic scaling
- Functions have timeout limits (60s for HTTP, 540s for background)
- Firestore has query limits (1MB per query result)
- Storage has file size limits (configurable)

## Dependencies

### Production Dependencies
- `react` ^19.2.0
- `react-dom` ^19.2.0
- `react-router-dom` ^7.9.5 (installed)
- `firebase` ^12.5.0 (installed)
- `@tiptap/react` ^3.10.5 (installed)
- `@tiptap/starter-kit` ^3.10.5 (installed)
- `@tiptap/extension-collaboration` ^3.10.5 (installed)
- `file-saver` ^2.0.5 (installed)
- `date-fns` ^4.1.0 (installed)

### Functions Dependencies
- `firebase-admin` ^12.6.0
- `firebase-functions` ^6.0.1
- `openai` ^6.8.1
- `dotenv` ^17.2.3
- **Note:** `pdf-parse` removed - using OpenAI Files API instead for PDF processing

### Development Dependencies
- `typescript` ~5.9.3
- `vite` ^7.2.2
- `@vitejs/plugin-react` ^5.1.0
- `eslint` ^9.39.1
- `typescript-eslint` ^8.46.3
- `@types/react` ^19.2.2
- `@types/react-dom` ^19.2.2

## API Integrations

### OpenAI API
- **Text Generation Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Vision Endpoint:** `https://api.openai.com/v1/chat/completions` (with image inputs)
- **Authentication:** Bearer token (stored in Firebase config)
- **Models:** 
  - GPT-4 for text generation
  - GPT-4 Vision (gpt-4-vision-preview) for document analysis
- **Rate Limits:** Per API key (check OpenAI dashboard)
- **Cost:** Pay-per-use (tokens + image processing)

### Firebase APIs
- **Authentication:** REST API and SDK
- **Firestore:** Real-time database SDK
- **Functions:** HTTP callable functions (v2 API)

## Known Technical Decisions

1. **No state management library:** Using React hooks and Firestore real-time listeners
2. **No UI component library:** Custom CSS for full control
3. **Serverless backend:** Firebase Functions instead of traditional server
4. **TypeScript strict mode:** Enabled for type safety
5. **Vite over Create React App:** Faster builds and better DX

## Future Technical Considerations

- **Testing:** Add Jest and React Testing Library
- **CI/CD:** GitHub Actions for automated deployment
- **Monitoring:** Firebase Performance Monitoring
- **Analytics:** Firebase Analytics integration
- **Error Tracking:** Sentry or Firebase Crashlytics

