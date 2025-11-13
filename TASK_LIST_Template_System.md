# Task List: Template System

**Based on:** PRD_Template_System.md  
**Feature:** Template Management System  
**Estimated Time:** 12-17 hours

---

## Relevant Files

### Backend - Firebase Functions
- `functions/src/index.ts` - Add `analyzeTemplateFromPDF` function, update `generateLetter` function
- `firestore.rules` - Add security rules for `templates` collection

### Frontend - Pages
- `src/pages/TemplatesList.tsx` - New templates list page (similar to DocumentsList)
- `src/pages/TemplatesList.css` - Styling for templates list page
- `src/App.tsx` - Add routes for templates

### Frontend - Components
- `src/components/TemplateCard.tsx` - Template card component (similar to DocumentCard)
- `src/components/TemplateUpload.tsx` - PDF upload component for templates
- `src/components/ChatSidebar.tsx` - Update to add template selector

### Frontend - Editor
- `src/pages/Editor.tsx` - Update to handle template mode (detect route, save to templates collection)

### TypeScript Interfaces
- Add `Template` interface to relevant files

---

## Tasks

- [ ] 1.0 **Setup Templates Infrastructure**
  - [ ] 1.1 Add `Template` TypeScript interface to project
  - [ ] 1.2 Add Firestore security rules for `templates` collection
  - [ ] 1.3 Create system default template document in Firestore (manual setup or script)
  - [ ] 1.4 Update Firebase config/initialization if needed

- [ ] 2.0 **Create Templates List Page**
  - [ ] 2.1 Create `src/pages/TemplatesList.tsx` (similar structure to DocumentsList)
  - [ ] 2.2 Create `src/pages/TemplatesList.css` for styling
  - [ ] 2.3 Implement template fetching from Firestore (query templates by userId + system default)
  - [ ] 2.4 Display templates in grid layout
  - [ ] 2.5 Add "Create New Template" button (navigates to `/templates/editor`)
  - [ ] 2.6 Add "Upload PDF" button (opens TemplateUpload modal)
  - [ ] 2.7 Add delete functionality (only for user templates, not system default)
  - [ ] 2.8 Add empty state when no templates exist

- [ ] 3.0 **Create Template Card Component**
  - [ ] 3.1 Create `src/components/TemplateCard.tsx`
  - [ ] 3.2 Display template name, creation date
  - [ ] 3.3 Add click handler to navigate to template editor
  - [ ] 3.4 Add delete button (disabled for system default)
  - [ ] 3.5 Add visual indicator for system default template
  - [ ] 3.6 Style template card (similar to DocumentCard)

- [ ] 4.0 **Add Templates Routes**
  - [ ] 4.1 Update `src/App.tsx` to add `/templates` route
  - [ ] 4.2 Add `/templates/editor/:templateId?` route
  - [ ] 4.3 Wrap routes with ProtectedRoute component
  - [ ] 4.4 Update navigation/links to include templates page

- [ ] 5.0 **Update Editor for Template Mode**
  - [ ] 5.1 Update `src/pages/Editor.tsx` to detect route (document vs template)
  - [ ] 5.2 Add template mode state/flag based on route
  - [ ] 5.3 Load template from `templates` collection if template mode
  - [ ] 5.4 Pre-fill editor with default template structure when creating new template
  - [ ] 5.5 Update save functionality to save to `templates` collection in template mode
  - [ ] 5.6 Add template name input field (only in template mode)
  - [ ] 5.7 Update page title/header to indicate "Template Editor"

- [ ] 6.0 **Create PDF Upload Component for Templates**
  - [ ] 6.1 Create `src/components/TemplateUpload.tsx`
  - [ ] 6.2 Implement file upload UI (drag-and-drop + file picker)
  - [ ] 6.3 Upload PDF to Firebase Storage
  - [ ] 6.4 Call `analyzeTemplateFromPDF` Firebase Function
  - [ ] 6.5 Display loading state during analysis
  - [ ] 6.6 On success, create template document with AI-generated HTML
  - [ ] 6.7 Navigate to template editor with new template
  - [ ] 6.8 Handle errors and display user-friendly messages

- [ ] 7.0 **Create analyzeTemplateFromPDF Firebase Function**
  - [ ] 7.1 Add `analyzeTemplateFromPDF` function to `functions/src/index.ts`
  - [ ] 7.2 Accept PDF file path or buffer as input
  - [ ] 7.3 Download PDF from Storage
  - [ ] 7.4 Upload PDF to OpenAI Files API
  - [ ] 7.5 Create AI prompt to analyze PDF structure and generate HTML template
  - [ ] 7.6 Call OpenAI API to analyze PDF and extract visual structure
  - [ ] 7.7 Generate HTML template with placeholders from analysis
  - [ ] 7.8 Clean up: delete PDF from OpenAI after processing
  - [ ] 7.9 Return generated HTML template
  - [ ] 7.10 Add error handling and logging

- [ ] 8.0 **Add Template Selector to Chat Sidebar**
  - [ ] 8.1 Update `src/components/ChatSidebar.tsx` to add template state
  - [ ] 8.2 Fetch available templates (user templates + system default)
  - [ ] 8.3 Add template selector UI (dropdown or button)
  - [ ] 8.4 Display currently selected template
  - [ ] 8.5 Default to system default template
  - [ ] 8.6 Update `handleSend` to pass `templateId` when generating letter

- [ ] 9.0 **Update generateLetter Function for Templates**
  - [ ] 9.1 Update `generateLetter` function signature to accept `templateId` parameter (optional)
  - [ ] 9.2 Load template from Firestore if `templateId` provided
  - [ ] 9.3 If no `templateId`, use system default template
  - [ ] 9.4 Update AI prompt to include template HTML structure
  - [ ] 9.5 Instruct AI to maintain template structure and fill with extracted data
  - [ ] 9.6 Test generation with different templates
  - [ ] 9.7 Add fallback logic if template not found

- [ ] 10.0 **Create Default Template Content**
  - [ ] 10.1 Design default template HTML structure
  - [ ] 10.2 Include common sections (header, date, recipient, salutation, body, closing)
  - [ ] 10.3 Add standard placeholders ([client name], [date], [amount], etc.)
  - [ ] 10.4 Ensure professional formatting
  - [ ] 10.5 Document default template structure

- [ ] 11.0 **Testing and Polish**
  - [ ] 11.1 Test template creation (manual)
  - [ ] 11.2 Test template creation (PDF upload)
  - [ ] 11.3 Test template editing
  - [ ] 11.4 Test template deletion
  - [ ] 11.5 Test template selection in chat
  - [ ] 11.6 Test letter generation with custom template
  - [ ] 11.7 Test letter generation with default template
  - [ ] 11.8 Verify security rules work correctly
  - [ ] 11.9 Polish UI/UX
  - [ ] 11.10 Add loading states and error messages
  - [ ] 11.11 Test responsive design
  - [ ] 11.12 Verify performance (< 5 second requirement)

---

## Time Estimates

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1: Infrastructure | Task 1 | 1 hour |
| Phase 2: Templates Page | Tasks 2-4 | 3-4 hours |
| Phase 3: Editor Updates | Task 5 | 2-3 hours |
| Phase 4: PDF Upload | Tasks 6-7 | 3-4 hours |
| Phase 5: Template Selection | Tasks 8-9 | 2-3 hours |
| Phase 6: Default Template | Task 10 | 1 hour |
| Phase 7: Testing | Task 11 | 2-3 hours |
| **TOTAL** | **11 tasks** | **14-19 hours** |

**Realistic estimate: 12-17 hours** (with experience)

---

## Notes

### Template Structure
Templates are HTML documents with placeholders:
- Placeholders use bracket notation: `[client name]`, `[date]`, `[amount]`
- AI fills placeholders with data extracted from source PDFs
- Templates maintain visual structure and formatting

### Default Template
- System default template is always available
- Marked with `isSystemDefault: true`
- Cannot be edited or deleted
- Accessible to all users

### PDF to Template Flow
1. User uploads PDF on Templates page
2. PDF sent to `analyzeTemplateFromPDF` function
3. AI analyzes PDF structure and formatting
4. AI generates HTML template with placeholders
5. Template created and editor opens with generated HTML
6. User can edit before saving

### Letter Generation with Templates
1. User selects template in ChatSidebar
2. `templateId` passed to `generateLetter` function
3. Function loads template HTML from Firestore
4. AI prompt includes template structure
5. AI fills template with data from source PDFs
6. Generated letter maintains template design

---

## Quick Start Commands

```bash
# 1. Update Firestore rules
firebase deploy --only firestore:rules

# 2. Create default template (manual or via Firestore console)
# - Collection: templates
# - Document ID: (auto-generated)
# - Fields: name, content, isSystemDefault, userId, createdAt, updatedAt

# 3. Deploy Functions
cd functions
npm run build
firebase deploy --only functions

# 4. Start dev server
npm run dev
```

---

**Ready to implement! Start with Phase 1, Task 1.1** 🚀

