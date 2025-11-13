# Product Requirements Document: Template System

**Project:** Themis - Demand Letter Generator  
**Feature:** Template Management System  
**Date:** November 2025  
**Status:** Planning

## 1. Introduction/Overview

The Template System allows users to create and manage visual templates for demand letters. Templates define the structure, style, and formatting of letters. Users can create templates manually or by uploading sample PDFs that are analyzed to extract their visual design.

### Problem Statement
Currently, all generated letters use a hardcoded structure. Users need the ability to:
- Define custom visual styles and formats for their demand letters
- Maintain firm-specific letter templates
- Upload sample letters and extract their design/structure
- Select which template to use when generating letters

### Goal
Enable users to create, manage, and use custom visual templates that define the structure and style of generated demand letters.

## 2. Goals

1. **Template Management**: Users can create, view, edit, and delete custom templates
2. **Visual Design**: Templates define the HTML structure and formatting of letters
3. **PDF Analysis**: AI can extract visual structure from uploaded PDF samples
4. **Template Selection**: Users can choose which template to use when generating letters
5. **Default Template**: System provides a default template that cannot be deleted

## 3. User Stories

1. **As an attorney**, I want to create custom templates so that my demand letters match my firm's style and branding.

2. **As an attorney**, I want to upload a sample demand letter PDF so that the system can create a template matching its design.

3. **As an attorney**, I want to edit existing templates so that I can refine the structure and formatting.

4. **As an attorney**, I want to select which template to use so that generated letters have the appropriate format for the case type.

5. **As an attorney**, I want a default template available so that I can start generating letters immediately without creating a custom template.

## 4. Functional Requirements

### 4.1 Template Storage
1. Templates must be stored in Firestore `templates` collection
2. Each template must have: id, name, content (HTML), isSystemDefault, userId, createdAt, updatedAt
3. System must provide one default template marked as `isSystemDefault: true`
4. Default template cannot be edited or deleted
5. Users can only access their own templates plus the system default

### 4.2 Templates Page
1. Must display a list of available templates (default + user templates)
2. Must show template name and preview
3. Must have "Create New Template" button
4. Must have "Upload PDF" button
5. Must allow clicking a template to open it in the editor
6. Must allow deleting user templates (not system default)

### 4.3 Template Creation - Manual
1. "Create New Template" button creates a new template document
2. Opens editor (`/templates/editor/:templateId`) with default HTML structure pre-filled
3. User can edit the HTML content with placeholders like [client name], [date], [amount]
4. Save button saves template to Firestore `templates` collection

### 4.4 Template Creation - PDF Upload
1. "Upload PDF" button allows selecting a PDF file
2. PDF is uploaded and sent to Firebase Function `analyzeTemplateFromPDF`
3. AI analyzes PDF and extracts visual structure/formatting
4. AI generates HTML template with placeholders
5. Template document is created and editor opens with generated HTML
6. User can edit before saving

### 4.5 Template Editor
1. Uses same Editor component as documents
2. Route: `/templates/editor/:templateId?`
3. Pre-filled with default structure when creating new
4. Saves to `templates` collection instead of `documents`
5. Shows template name input field
6. Has save functionality specific to templates

### 4.6 Template Selection in Chat
1. Chat sidebar must show current template being used
2. Must have template selector (dropdown or button)
3. Default to system default template
4. Selected template persists during session
5. Pass selected `templateId` when generating letters

### 4.7 Letter Generation with Templates
1. `generateLetter` function must accept `templateId` parameter (optional)
2. If `templateId` provided, load template from Firestore
3. If no `templateId`, use system default template
4. AI prompt must include template HTML structure
5. AI must fill template with data extracted from source PDFs
6. Generated letter must maintain template's visual structure

## 5. Non-Goals (Out of Scope)

1. Template sharing between users
2. Template marketplace or library
3. Advanced template builder with drag-and-drop
4. Template versioning or history
5. Multiple templates per document
6. Real-time collaborative template editing
7. Template categories or tags (future enhancement)
8. Template preview with sample data (future enhancement)

## 6. Design Considerations

### 6.1 User Interface
- Templates page mirrors Documents page design
- Template cards show name and small preview
- Editor looks identical to document editor
- Clear visual indicator when editing a template vs document

### 6.2 Template Structure
Templates contain HTML with placeholders:
```html
<p><strong>[Law Firm Name]</strong></p>
<p>[Law Firm Address]</p>
<p>[City, State ZIP]</p>
<p>[Phone Number]</p>
<p>[Email]</p>

<p>[Date]</p>

<p><strong>[Recipient Name]</strong></p>
<p>[Recipient Title]</p>
<p>[Recipient Company]</p>
<p>[Recipient Address]</p>

<p>Dear [Recipient Name],</p>

<p>This letter serves as a formal demand regarding [Case Subject]...</p>

<p><strong>Facts:</strong></p>
<p>[Case Facts]</p>

<p><strong>Demand:</strong></p>
<p>[Demand Details]</p>

<p>Please respond by [Deadline Date].</p>

<p>Sincerely,</p>
<p>[Attorney Name]</p>
```

### 6.3 Default Template
System default template contains professional demand letter structure with common sections:
- Header (law firm info)
- Date
- Recipient info
- Salutation
- Introduction
- Facts section
- Demand section
- Deadline
- Closing

## 7. Technical Considerations

### 7.1 Firestore Structure
```typescript
// templates collection
{
  id: string;
  name: string;
  content: string; // HTML with placeholders
  isSystemDefault: boolean;
  userId: string; // "system" for default, user ID for custom
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 7.2 Firebase Function: analyzeTemplateFromPDF
- Input: PDF file buffer
- Process: Upload to OpenAI Files API → AI analyzes structure → Generate HTML
- Output: HTML template with placeholders
- Cleanup: Delete file from OpenAI after processing

### 7.3 Firebase Function: generateLetter (Updated)
- Add `templateId` parameter (optional)
- Load template from Firestore
- Include template HTML in AI prompt
- AI fills template structure with extracted data

### 7.4 Routes
- `/templates` - Templates list page
- `/templates/editor/:templateId?` - Template editor

### 7.5 Security Rules
```javascript
match /templates/{templateId} {
  allow read: if request.auth != null && 
    (resource.data.userId == request.auth.uid || resource.data.isSystemDefault == true);
  allow create, update: if request.auth != null && 
    request.auth.uid == request.resource.data.userId;
  allow delete: if request.auth != null && 
    request.auth.uid == resource.data.userId && 
    resource.data.isSystemDefault == false;
}
```

## 8. Success Metrics

1. **Adoption**: 60% of users create at least one custom template within first month
2. **Usage**: 40% of generated letters use custom templates (not default)
3. **PDF Upload**: 50% of custom templates created via PDF upload
4. **Satisfaction**: User feedback indicates templates meet their needs
5. **Performance**: Template loading and generation time < 5 seconds

## 9. Open Questions

1. Should templates support rich formatting (colors, fonts, borders)?
2. Should we provide sample templates for common case types?
3. How many templates should a user be allowed to create?
4. Should template selection be per-document or per-generation?
5. Should we validate template structure (require certain placeholders)?

## 10. Implementation Phases

### Phase 1: Foundation (Priority: High)
- Create `templates` collection structure
- Create system default template
- Build Templates list page
- Implement basic template CRUD

### Phase 2: Template Editor (Priority: High)
- Add `/templates/editor/:templateId?` route
- Reuse Editor component with template mode
- Implement template save functionality
- Pre-fill default structure

### Phase 3: PDF Upload (Priority: Medium)
- Create `analyzeTemplateFromPDF` function
- Implement PDF upload on Templates page
- AI analysis and HTML generation
- Open editor with generated template

### Phase 4: Template Selection (Priority: High)
- Add template selector to ChatSidebar
- Update `generateLetter` to accept `templateId`
- Load and use template when generating
- AI fills template with extracted data

### Phase 5: Polish & Testing (Priority: Medium)
- Template preview functionality
- Error handling and validation
- UI polish and responsive design
- Comprehensive testing

## 11. Dependencies

- Existing Editor component
- Firebase Functions (generateLetter)
- OpenAI API
- Firestore database
- Firebase Storage (for PDF upload)

## 12. Timeline Estimate

- Phase 1: 3-4 hours
- Phase 2: 2-3 hours
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours

**Total: 12-17 hours**

## 13. Acceptance Criteria

1. Users can view list of available templates
2. Users can create new templates manually
3. Users can upload PDFs to create templates
4. Users can edit existing templates
5. Users can delete their own templates (not default)
6. Users can select a template when generating letters
7. Generated letters maintain template structure
8. System default template is always available
9. Templates are user-specific (isolated by userId)
10. Performance meets < 5 second requirement

