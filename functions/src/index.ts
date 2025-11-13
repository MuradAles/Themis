/**
 * Firebase Functions for Themis - Demand Letter Generator
 * 
 * Functions:
 * - generateLetter: Generate demand letter from extracted text in Firestore
 * - refineLetter: Refine existing letter based on instructions
 * - chatWithAI: Chat interface with AI for letter editing
 */

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {Readable} from "stream";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const storage = getStorage();
const adminAuth = getAuth();

// Define secrets
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = openaiApiKey.value();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY secret is not set");
  }
  return new OpenAI({apiKey});
}

/**
 * Task 2.1: Generate Letter Function
 * Generates a demand letter from extracted text stored in Firestore
 */
export const generateLetter = onCall(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {sourceDocumentIds, templateId, currentLetter} = request.data;

      if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
        throw new HttpsError("invalid-argument", "sourceDocumentIds array is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Generating letter for user ${userId} with ${sourceDocumentIds.length} source documents${templateId ? ` using template ${templateId}` : ''}${currentLetter ? ' (with existing content)' : ''}`);

      // Get document metadata and download PDFs from Storage
      const pdfFiles: Array<{name: string; data: Buffer}> = [];
      
      for (const docId of sourceDocumentIds) {
        const docRef = db.collection("sourceDocuments").doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new HttpsError("not-found", `Source document ${docId} not found`);
        }

        const docData = docSnap.data();
        if (!docData || !docData.storagePath) {
          throw new HttpsError("failed-precondition", `Source document ${docId} has no storage path`);
        }

        const documentName = docData.name || docId;
        const storagePath = docData.storagePath;

        // Download PDF from Storage
        try {
          const bucket = storage.bucket();
          const file = bucket.file(storagePath);
          const [fileBuffer] = await file.download();
          pdfFiles.push({name: documentName, data: fileBuffer});
          logger.info(`Downloaded PDF: ${documentName} (${fileBuffer.length} bytes)`);
        } catch (error) {
          logger.error(`Failed to download PDF ${storagePath}:`, error);
          throw new HttpsError("internal", `Failed to download document ${documentName}`);
        }
      }

      // Upload PDFs to OpenAI Files API and get file IDs
      const openai = getOpenAIClient();
      const fileIds: string[] = [];
      const fileIdToName: Map<string, string> = new Map();
      
      for (const pdf of pdfFiles) {
        try {
          // Create a proper Readable stream from Buffer
          const fileStream = new Readable();
          fileStream.push(pdf.data);
          fileStream.push(null); // End the stream
          
          // Create a File-like object that OpenAI SDK expects
          const fileName = pdf.name.endsWith('.pdf') ? pdf.name : `${pdf.name}.pdf`;
          const fileLike = Object.assign(fileStream, {
            name: fileName,
            type: 'application/pdf',
          }) as any;
          
          // Upload file to OpenAI using the SDK
          // For Chat Completions API, use purpose: "user_data"
          const fileResponse = await openai.files.create({
            file: fileLike,
            purpose: 'user_data', // Required for Chat Completions API
          });

          fileIds.push(fileResponse.id);
          fileIdToName.set(fileResponse.id, pdf.name);
          logger.info(`Uploaded PDF to OpenAI: ${pdf.name} (file_id: ${fileResponse.id})`);
          
          // Wait for file to be processed (check status)
          let fileReady = false;
          let attempts = 0;
          while (!fileReady && attempts < 10) {
            const fileStatus = await openai.files.retrieve(fileResponse.id);
            logger.info(`File ${fileResponse.id} status: ${fileStatus.status}`);
            if (fileStatus.status === 'processed') {
              fileReady = true;
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              attempts++;
            }
          }
          
          if (!fileReady) {
            logger.warn(`File ${fileResponse.id} not processed after 10 attempts`);
          }
        } catch (error) {
          logger.error(`Failed to upload PDF ${pdf.name} to OpenAI:`, error);
          throw new HttpsError("internal", `Failed to upload document ${pdf.name} to OpenAI`);
        }
      }
      
      if (fileIds.length === 0) {
        throw new HttpsError("internal", "No files were successfully uploaded to OpenAI");
      }
      
      logger.info(`Successfully uploaded ${fileIds.length} files: ${fileIds.join(', ')}`);

      // Load template if templateId is provided
      let templateHTML = '';
      if (templateId) {
        try {
          const templateRef = db.collection("templates").doc(templateId);
          const templateSnap = await templateRef.get();
          
          if (templateSnap.exists) {
            const templateData = templateSnap.data();
            templateHTML = templateData?.content || '';
            logger.info(`Loaded template ${templateId}: ${templateData?.name}`);
          } else {
            logger.warn(`Template ${templateId} not found, using default structure`);
          }
        } catch (error) {
          logger.error(`Error loading template ${templateId}:`, error);
          logger.warn("Continuing with default structure");
        }
      }

      // Build document list with names for the prompt
      const documentList = fileIds.map((fileId, index) => {
        const docName = fileIdToName.get(fileId) || `Document ${index + 1}`;
        return `Document ${index + 1} (file_id: ${fileId}): "${docName}"`;
      }).join('\n');

      // Build prompt based on whether template is provided
      let promptText = '';
      
      if (templateHTML) {
        // Use template-based prompt
        const currentLetterSection = currentLetter ? `

EXISTING DOCUMENT CONTENT:
The user already has content in their document. Review it below:

${currentLetter}

IMPORTANT: Use this existing content as a reference. Keep good information that's already there, update outdated information with data from the PDFs, and fill in missing sections using the template structure.` : '';

        promptText = `Please generate a demand letter based on the attached source documents using the provided template structure.${currentLetterSection}

STEP-BY-STEP PROCESS:

STEP 1: READ THE ATTACHED PDF FILES
You have ${fileIds.length} PDF document(s) attached. You MUST read each PDF file completely before generating the letter.

Attached documents:
${documentList}

STEP 2: EXTRACT INFORMATION FROM EACH PDF
For each PDF document, extract ALL of the following information that is explicitly stated:
- Client/Plaintiff names (tenant, employee, customer, etc.)
- Recipient/Defendant names (landlord, employer, company, etc.)
- Law firm names (if mentioned)
- Dates (incident date, move-out date, invoice date, deadline, etc.)
- Addresses (property address, mailing address, business address, etc.)
- Amounts (security deposit, unpaid wages, invoice amount, damages, etc.)
- Phone numbers
- Email addresses
- Case numbers, reference numbers, invoice numbers
- Any other factual information relevant to the demand letter

STEP 3: USE THE TEMPLATE STRUCTURE
Below is the template structure to follow. It contains placeholders in brackets like [Field Name]:

${templateHTML}

STEP 4: ${currentLetter ? 'MERGE EXISTING CONTENT WITH NEW DATA' : 'FILL THE TEMPLATE WITH EXTRACTED DATA'}
${currentLetter ? `- Review the existing document content above
- Keep well-written sections that are still accurate
- Update any outdated information with data from the PDFs
- Add missing sections based on the template
- Fill any remaining placeholders with extracted data
- Maintain consistency in tone and style` : `- Replace placeholders with ACTUAL data extracted from the PDFs
- Use real names, dates, amounts, addresses from the documents
- Maintain the template's structure and formatting
- If a placeholder's information is NOT in the PDFs, keep the placeholder as-is
- DO NOT create a generic template - use actual extracted information`}

FORMATTING REQUIREMENTS:
- Output ONLY clean HTML format (use <p>, <strong>, <em>, <u> tags)
- Follow the template's structure exactly
- DO NOT use markdown syntax (no **, __, ---, #, code blocks, etc.)
- DO NOT wrap content in code blocks (no markdown code fences)
- DO NOT add comments, instructions, or notes in the document
- DO NOT add explanatory text like "This draft uses..." or "Let me know if..."
- Start directly with the HTML content, no code blocks, no explanations

Generate a professional demand letter using the template structure${currentLetter ? ', existing content,' : ''} and the ACTUAL information extracted from the attached PDF documents.`;
      } else {
        // Use default prompt (original)
        const currentLetterSection = currentLetter ? `

EXISTING DOCUMENT CONTENT:
The user already has content in their document. Review it below:

${currentLetter}

IMPORTANT: Use this existing content as a reference. Keep good information that's already there, update outdated information with data from the PDFs, and enhance or complete any missing sections.` : '';

        promptText = `Please generate a demand letter based on the attached source documents.${currentLetterSection}

STEP-BY-STEP PROCESS:

STEP 1: READ THE ATTACHED PDF FILES
You have ${fileIds.length} PDF document(s) attached. You MUST read each PDF file completely before generating the letter.

Attached documents:
${documentList}

STEP 2: EXTRACT INFORMATION FROM EACH PDF
For each PDF document, extract ALL of the following information that is explicitly stated:
- Client/Plaintiff names (tenant, employee, customer, etc.)
- Recipient/Defendant names (landlord, employer, company, etc.)
- Law firm names (if mentioned)
- Dates (incident date, move-out date, invoice date, deadline, etc.)
- Addresses (property address, mailing address, business address, etc.)
- Amounts (security deposit, unpaid wages, invoice amount, damages, etc.)
- Phone numbers
- Email addresses
- Case numbers, reference numbers, invoice numbers
- Any other factual information relevant to the demand letter

STEP 3: ${currentLetter ? 'MERGE EXISTING CONTENT WITH NEW DATA' : 'USE EXTRACTED INFORMATION TO FILL THE LETTER'}
${currentLetter ? `- Review the existing document content above
- Keep well-written sections that are still accurate
- Update any outdated information with data from the PDFs
- Add missing sections or information
- Enhance the letter with additional details from the PDFs
- Maintain consistency in tone and style` : `- Fill the demand letter with ACTUAL data extracted from the PDFs
- Use real names, dates, amounts, addresses from the documents
- DO NOT create a generic template - use the actual extracted information
- DO NOT use placeholders like "[Put client name here]" - use the actual names from the documents`}

STEP 4: USE PLACEHOLDERS ONLY FOR MISSING INFORMATION
Only use simple bracket placeholders for information that is TRULY NOT in any of the documents${currentLetter ? ' and not in the existing content' : ''}:
- [client name] - only if no client name found in any document
- [date] - only if no relevant dates found
- [recipient name] - only if no recipient name found
- [amount] - only if no amounts found
- [address] - only if no addresses found
- [phone number] - only if no phone numbers found
- [email] - only if no email addresses found
- [law firm name] - only if no law firm name found
- [case number] - only if no case numbers found

CRITICAL: ${currentLetter ? 'Merge existing content with new data intelligently. Keep good information, update outdated information, and fill in gaps.' : 'DO NOT create a generic template. Extract real information from the PDFs and use it in the letter. Only use placeholders for information that is genuinely missing.'}

FORMATTING REQUIREMENTS:
- Output ONLY clean HTML format (use <p>, <strong>, <em>, <u> tags)
- DO NOT use markdown syntax (no **, __, ---, #, code blocks, etc.)
- DO NOT wrap content in code blocks (no markdown code fences)
- DO NOT add comments, instructions, or notes in the document
- DO NOT include text like "Please ensure all provided details are accurate" or "Please complete any placeholders"
- DO NOT add explanatory text like "This draft uses..." or "Let me know if..."
- DO NOT add any text before or after the document content
- Use <strong> for bold, <em> for italic, <u> for underline
- Use <p> tags for paragraphs
- The document should contain ONLY the actual letter content, nothing else
- Start directly with the HTML content, no code blocks, no explanations

Generate a professional, well-structured demand letter using the ACTUAL information extracted from the attached PDF documents. Output clean HTML with NO markdown, NO code blocks, NO comments, NO instructions, NO explanatory text.`;
      }

      // Build message content with file references
      const userContent: any[] = [
        {
          type: "text",
          text: promptText,
        },
      ];

      // Add file references - use nested format: file: { file_id: ... }
      for (const fileId of fileIds) {
        userContent.push({
          type: "file",
          file: {
            file_id: fileId,
          },
        });
      }
      
      logger.info(`User content structure: ${JSON.stringify(userContent.map(item => ({ type: item.type, file_id: (item as any).file_id || 'N/A', file: (item as any).file || 'N/A', text: item.text ? item.text.substring(0, 50) + '...' : 'N/A' })))}`);
      logger.info(`File IDs: ${fileIds.join(', ')}`);

      // Call OpenAI to generate the letter
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a legal assistant specializing in drafting professional demand letters. 
            You analyze source documents (PDFs) and extract information to generate comprehensive, professional demand letters.
            
            CRITICAL RULES:
            1. FIRST: READ the attached PDF files completely. You must read and process each PDF document.
            2. SECOND: EXTRACT all information explicitly stated in the PDFs (names, dates, amounts, addresses, phone numbers, emails, etc.)
            3. THIRD: USE the extracted information to fill the demand letter with REAL data from the documents
            4. DO NOT create a generic template - the letter must contain actual extracted information
            5. DO NOT fabricate, invent, or guess any information
            6. For information NOT found in any document, use simple bracket placeholders: [client name], [date], [amount], [address], [phone number], [email], etc.
            7. Only use placeholders for information that is truly missing from all documents
            
            FORMATTING RULES:
            - Output ONLY clean HTML format (use <p>, <strong>, <em>, <u> tags)
            - DO NOT use markdown syntax (no **, __, ---, #, code blocks, etc.)
            - DO NOT wrap content in code blocks (no markdown code fences)
            - DO NOT add comments, instructions, or notes in the document
            - DO NOT include text like "Please ensure all provided details are accurate"
            - DO NOT add explanatory text like "This draft uses..." or "Let me know if..."
            - DO NOT add any text before or after the document content
            - Use <strong> for bold, <em> for italic, <u> for underline
            - Use <p> tags for paragraphs
            - The document should contain ONLY the actual letter content, nothing else
            - Start directly with the HTML content, no code blocks, no explanations
            
            The letter should be:
            - Clear and professional in tone
            - Well-structured with proper legal formatting
            - Based on REAL facts extracted from reading the PDF documents
            - Use bracket placeholders only for information that is genuinely missing
            - Appropriate for legal correspondence
            - Clean HTML output with NO markdown, NO comments, NO instructions`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      let generatedLetter = completion.choices[0]?.message?.content || "";

      if (!generatedLetter) {
        throw new HttpsError("internal", "Failed to generate letter from OpenAI");
      }

      // Clean up the response: remove code blocks and explanatory text
      // Remove markdown code blocks (```plaintext, ```html, ```, etc.)
      generatedLetter = generatedLetter.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
      
      // Remove common explanatory text patterns
      const explanatoryPatterns = [
        /This draft uses.*?extracted from the PDF.*?/gi,
        /Let me know if.*?changes.*?/gi,
        /This draft.*?comprehensive demand letter.*?/gi,
        /I've created.*?demand letter.*?/gi,
        /Here is.*?demand letter.*?/gi,
      ];
      
      for (const pattern of explanatoryPatterns) {
        generatedLetter = generatedLetter.replace(pattern, '').trim();
      }
      
      // Remove any trailing explanatory sentences
      const lines = generatedLetter.split('\n');
      if (lines.length > 3) {
        const lastFewLines = lines.slice(-3).join(' ').toLowerCase();
        if (lastFewLines.includes('let me know') || 
            lastFewLines.includes('this draft') || 
            lastFewLines.includes('if you need') ||
            lastFewLines.includes('additional information')) {
          // Remove last 3 lines if they look like explanatory text
          generatedLetter = lines.slice(0, -3).join('\n').trim();
        }
      }
      
      generatedLetter = generatedLetter.trim();

      // Clean up uploaded files from OpenAI
      for (const fileId of fileIds) {
        try {
          await openai.files.delete(fileId);
          logger.info(`Deleted file from OpenAI: ${fileId}`);
        } catch (error) {
          logger.warn(`Failed to delete file ${fileId} from OpenAI:`, error);
          // Don't fail the request if cleanup fails
        }
      }

      logger.info(`Successfully generated letter for user ${userId}`);
      return {letter: generatedLetter};
    } catch (error) {
      logger.error("Error generating letter:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to generate letter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Analyze Template From PDF Function
 * Analyzes a PDF file and extracts its visual structure/style to create a template
 */
export const analyzeTemplateFromPDF = onCall(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {storagePath, fileName} = request.data;

      if (!storagePath || typeof storagePath !== "string") {
        throw new HttpsError("invalid-argument", "storagePath is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Analyzing template PDF for user ${userId}: ${fileName}`);

      // Download PDF from Storage
      let pdfBuffer: Buffer;
      try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const [fileBuffer] = await file.download();
        pdfBuffer = fileBuffer;
        logger.info(`Downloaded PDF: ${fileName} (${fileBuffer.length} bytes)`);
      } catch (error) {
        logger.error(`Failed to download PDF ${storagePath}:`, error);
        throw new HttpsError("internal", `Failed to download PDF: ${fileName}`);
      }

      // Upload PDF to OpenAI Files API
      const openai = getOpenAIClient();
      let fileId: string;

      try {
        // Create a proper Readable stream from Buffer
        const fileStream = new Readable();
        fileStream.push(pdfBuffer);
        fileStream.push(null); // End the stream
        
        // Create a File-like object that OpenAI SDK expects
        const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        const fileLike = Object.assign(fileStream, {
          name: pdfFileName,
          type: 'application/pdf',
        }) as any;
        
        // Upload file to OpenAI
        const fileResponse = await openai.files.create({
          file: fileLike,
          purpose: 'user_data',
        });

        fileId = fileResponse.id;
        logger.info(`Uploaded PDF to OpenAI: ${pdfFileName} (file_id: ${fileId})`);
        
        // Wait for file to be processed
        let fileReady = false;
        let attempts = 0;
        while (!fileReady && attempts < 10) {
          const fileStatus = await openai.files.retrieve(fileId);
          logger.info(`File ${fileId} status: ${fileStatus.status}`);
          if (fileStatus.status === 'processed') {
            fileReady = true;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }
        
        if (!fileReady) {
          logger.warn(`File ${fileId} not processed after 10 attempts`);
        }
      } catch (error) {
        logger.error(`Failed to upload PDF to OpenAI:`, error);
        throw new HttpsError("internal", `Failed to upload PDF to OpenAI`);
      }

      // Analyze PDF structure with AI
      try {
        const userContent: any[] = [
          {
            type: "text",
            text: `Analyze this demand letter PDF and extract its visual structure and style to create an HTML template.

INSTRUCTIONS:
1. READ the attached PDF document completely
2. ANALYZE the structure, formatting, and style:
   - Header format (law firm info, addresses, contact details)
   - Date placement
   - Recipient address format
   - Salutation style
   - Body structure (introduction, facts, demand, closing)
   - Section headings and formatting
   - Paragraph spacing and indentation
   - Font styles (bold, italic, underline usage)
   - Any special formatting or layout patterns

3. GENERATE an HTML template that captures this structure with PLACEHOLDERS:
   - Use bracket notation for variable content: [Law Firm Name], [Client Name], [Date], etc.
   - Preserve the visual layout and formatting style
   - Use HTML tags: <p>, <strong>, <em>, <u>, <br>
   - Maintain spacing and structure from the original

4. COMMON PLACEHOLDERS to include where appropriate:
   - [Law Firm Name]
   - [Law Firm Address]
   - [City, State ZIP]
   - [Phone Number]
   - [Email]
   - [Date]
   - [Recipient Name]
   - [Recipient Title]
   - [Recipient Company]
   - [Recipient Address]
   - [Case Subject]
   - [Case Facts]
   - [Demand Details]
   - [Amount]
   - [Deadline Date]
   - [Attorney Name]

5. OUTPUT REQUIREMENTS:
   - Output ONLY clean HTML (no markdown, no code blocks, no explanations)
   - Use <p> tags for paragraphs, <strong> for bold, <em> for italic, <u> for underline
   - Start directly with the HTML content
   - NO code fences (no \`\`\`), NO comments, NO instructions
   - The HTML should be ready to use as-is in a template

Generate the HTML template now:`,
          },
          {
            type: "file",
            file: {
              file_id: fileId,
            },
          },
        ];

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing document structure and creating HTML templates. 
              You extract the visual layout, formatting style, and structure from documents and convert them into clean HTML templates with placeholders.
              
              CRITICAL RULES:
              1. Output ONLY clean HTML with placeholders
              2. NO markdown syntax, NO code blocks, NO explanations
              3. Use <p>, <strong>, <em>, <u> tags only
              4. Preserve the document's structure and formatting style
              5. Use bracket notation for placeholders: [Field Name]
              6. Start directly with HTML content, nothing else`,
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        let templateHTML = completion.choices[0]?.message?.content || "";

        if (!templateHTML) {
          throw new HttpsError("internal", "Failed to generate template from OpenAI");
        }

        // Clean up the response: remove code blocks if any
        templateHTML = templateHTML.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

        // Clean up uploaded file from OpenAI
        try {
          await openai.files.delete(fileId);
          logger.info(`Deleted file from OpenAI: ${fileId}`);
        } catch (error) {
          logger.warn(`Failed to delete file ${fileId} from OpenAI:`, error);
        }

        // Delete PDF from Storage (no longer needed)
        try {
          const bucket = storage.bucket();
          const file = bucket.file(storagePath);
          await file.delete();
          logger.info(`Deleted PDF from Storage: ${storagePath}`);
        } catch (error) {
          logger.warn(`Failed to delete PDF from Storage:`, error);
        }

        logger.info(`Successfully generated template for user ${userId}`);
        return {templateHTML};
      } catch (error) {
        // Clean up file from OpenAI on error
        try {
          await openai.files.delete(fileId);
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup file ${fileId}:`, cleanupError);
        }
        throw error;
      }
    } catch (error) {
      logger.error("Error analyzing template:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to analyze template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Task 2.2: Refine Letter Function
 * Refines an existing letter based on user instructions
 */
export const refineLetter = onCall(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {letter, instruction} = request.data;

      if (!letter || typeof letter !== "string") {
        throw new HttpsError("invalid-argument", "letter content is required");
      }

      if (!instruction || typeof instruction !== "string") {
        throw new HttpsError("invalid-argument", "refinement instruction is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Refining letter for user ${userId}`);

      // Call OpenAI to refine the letter
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a legal assistant helping to refine demand letters. 
            Apply the user's instructions to improve the letter while maintaining its professional 
            legal tone and structure.`,
          },
          {
            role: "user",
            content: `Please refine the following demand letter according to this instruction: "${instruction}"\n\nCurrent letter:\n${letter}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const refinedLetter = completion.choices[0]?.message?.content || "";

      if (!refinedLetter) {
        throw new HttpsError("internal", "Failed to refine letter from OpenAI");
      }

      logger.info(`Successfully refined letter for user ${userId}`);
      return {letter: refinedLetter};
    } catch (error) {
      logger.error("Error refining letter:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to refine letter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Task 2.3: Chat with AI Function
 * Chat interface for interactive letter editing
 */
export const chatWithAI = onCall(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const {message, sourceDocumentIds, conversationHistory, currentLetter, isTemplateMode} = request.data;

      if (!message || typeof message !== "string") {
        throw new HttpsError("invalid-argument", "message is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Chat request from user ${userId}`);

      // Download PDFs from Storage and upload to OpenAI if documents are provided
      const openai = getOpenAIClient();
      const fileIds: string[] = [];
      const fileIdToName: Map<string, string> = new Map();
      
      if (sourceDocumentIds && Array.isArray(sourceDocumentIds) && sourceDocumentIds.length > 0) {
        for (const docId of sourceDocumentIds) {
          try {
            const docRef = db.collection("sourceDocuments").doc(docId);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
              const docData = docSnap.data();
              if (docData?.storagePath) {
                const documentName = docData.name || docId;
                
                // Download PDF from Storage
                const bucket = storage.bucket();
                const file = bucket.file(docData.storagePath);
                const [fileBuffer] = await file.download();

                // Create a proper Readable stream from Buffer
                const fileStream = new Readable();
                fileStream.push(fileBuffer);
                fileStream.push(null); // End the stream
                
                // Create a File-like object that OpenAI SDK expects
                const fileName = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;
                const fileLike = Object.assign(fileStream, {
                  name: fileName,
                  type: 'application/pdf',
                }) as any;
                
                // Upload to OpenAI Files API
                const fileResponse = await openai.files.create({
                  file: fileLike,
                  purpose: 'user_data', // Required for Chat Completions API
                });

                fileIds.push(fileResponse.id);
                fileIdToName.set(fileResponse.id, documentName);
                logger.info(`Uploaded document ${documentName} to OpenAI (file_id: ${fileResponse.id})`);
              }
            }
          } catch (error) {
            logger.warn(`Failed to process document ${docId}:`, error);
          }
        }
      }

      // Build document context message with names
      let documentContext = "";
      if (fileIds.length > 0) {
        const documentList = fileIds.map((fileId, index) => {
          const docName = fileIdToName.get(fileId) || `Document ${index + 1}`;
          return `Document ${index + 1}: "${docName}" (file_id: ${fileId})`;
        }).join('\n');
        
        documentContext = `\n\nYou have access to ${fileIds.length} source document(s) that have been uploaded. You MUST read these PDF files to extract information.

Attached documents:
${documentList}

CRITICAL: When the user asks about information or requests changes, you MUST read the attached PDF documents first to extract the actual information. Use real data from the documents, not placeholders.`;
      }

      // Build conversation messages
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a legal assistant helping to draft and refine demand letters. 
          
          CRITICAL RULES:
          1. You ONLY work on the document. All your actions modify the document, not the chat.
          2. When the user gives a COMMAND or INSTRUCTION, IMMEDIATELY update the document:
             - Examples: "change phone number", "update name", "make it more formal", "make it casual", "change tone", "change format", "make it professional", "make it friendly", etc.
             - IMMEDIATELY update the document with the changes
             - DO NOT respond in chat with explanations or questions
             - DO NOT ask "what do you want to change?" - just make the change
             - DO NOT ask for clarification - interpret the command and execute it
             - For style/tone changes: rewrite the document in the requested style (formal, casual, professional, friendly, etc.)
             - DO NOT ask for information - just use bracket placeholders like [client name], [date], [email], [phone number], etc.
             - Return the updated document in UPDATED_DOCUMENT_START/END format
             - After UPDATED_DOCUMENT_END, provide ONLY a brief confirmation (1 sentence max) like "I've updated the document to be more formal." or "I've changed the tone to casual."
          3. When the user asks a QUESTION (like "what is this?", "explain", "how does this work?", etc.):
             - You can respond in chat to answer the question
             - But still focus on the document context
          4. For "create doc" commands:
             - IMMEDIATELY create a demand letter template with bracket placeholders for ANY missing information
             - Use simple bracket notation: [client name], [date], [recipient name], [amount], [address], [phone number], [email], [deadline], [law firm name], [case number], etc.
             - If ANY information is missing, use [something] format (e.g., [email], [phone], [address], [date])
             - DO NOT ask questions - just create it with placeholders
             - Return it in UPDATED_DOCUMENT_START/END format
          
          FORMATTING RULES:
          - Output ONLY clean HTML format (use <p>, <strong>, <em>, <u> tags)
          - DO NOT use markdown syntax (no **, __, ---, #, etc.)
          - DO NOT add comments, instructions, or notes in the document
          - DO NOT include text like "Please ensure all provided details are accurate" or "Please complete any placeholders"
          - Use <strong> for bold, <em> for italic, <u> for underline
          - Use <p> tags for paragraphs
          - The document should contain ONLY the actual letter content, nothing else
          
          ${documentContext}`,
        },
      ];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current letter context if provided
      let updatedLetter = currentLetter || "";
      if (currentLetter) {
        const isTemplate = (isTemplateMode as boolean) === true;
        const documentType = isTemplate ? "template" : "document";
        
        messages.push({
          role: "system",
          content: `You are working with an EXISTING ${documentType}. When the user gives ANY command or instruction, you must UPDATE the existing ${documentType} content - DO NOT create a new ${documentType}.

Current ${documentType} content:
${currentLetter}

CRITICAL INSTRUCTIONS:
1. You are EDITING an EXISTING ${documentType}, NOT creating a new one.
2. ALL user commands must result in UPDATING the existing ${documentType}:
   - When user says "add [something]" or "I want to add [something]": ADD it to the existing ${documentType}, keeping all existing content
   - When user says "change [something]" or "update [something]": MODIFY the existing content
   - Specific changes: "change phone number to X", "update name to Y", "change date to Z", "add kids name"
   - Style/tone changes: "make it more formal", "make it casual", "change tone", "change format", "make it professional", "make it friendly"
   - For style changes: REWRITE the entire ${documentType} in the requested style while keeping all factual information and structure
   - For additions: ADD the requested elements (like placeholders for kids' names) to the existing ${documentType} structure
3. DO NOT create a new ${documentType} - always UPDATE the existing one
4. DO NOT ask for clarification - interpret the command and execute it
5. DO NOT say "I've created a new ${documentType}" - you are UPDATING the existing one
6. Find the relevant text in the ${documentType} (look for placeholders like [phone number] or actual existing text)
7. For additions: Add new placeholders or sections while preserving all existing content
8. Replace or add content as needed, but always return the COMPLETE updated ${documentType}
9. You MUST return the COMPLETE updated ${documentType} in this exact format (this will be extracted automatically, not shown to user):

UPDATED_DOCUMENT_START
[put the complete updated ${documentType} content here - include ALL existing content plus any additions/changes]
UPDATED_DOCUMENT_END

10. After the UPDATED_DOCUMENT_END, provide ONLY a simple confirmation message (1 sentence max):
   - If successful: "I've updated the ${documentType} to add [thing]." or "I've added [thing] to the ${documentType}." or "I've changed the ${documentType} to be more [style]."
   - NEVER say "I've created" - always say "I've updated" or "I've added"
   - NEVER ask for clarification - always make a change

DO NOT repeat the ${documentType} content in your confirmation. Keep it short and simple.`,
        });
      }

      // Build user message with file references if available
      if (fileIds.length > 0) {
        const documentList = fileIds.map((fileId, index) => {
          const docName = fileIdToName.get(fileId) || `Document ${index + 1}`;
          return `Document ${index + 1}: "${docName}" (file_id: ${fileId})`;
        }).join('\n');
        
        const userContent: any[] = [
          {
            type: "text",
            text: `${message}

IMPORTANT: You have ${fileIds.length} PDF document(s) attached. You MUST read these PDF files to extract information before responding.

Attached documents:
${documentList}

CRITICAL: If the user's message requires information from the documents, you MUST read the attached PDF files first to extract the actual information. Use real data from the documents, not placeholders.`,
          },
        ];
        // Add file references - use nested format: file: { file_id: ... }
        for (const fileId of fileIds) {
          userContent.push({
            type: "file",
            file: {
              file_id: fileId,
            },
          });
        }
        messages.push({
          role: "user",
          content: userContent,
        });
      } else {
      messages.push({
        role: "user",
        content: message,
      });
      }

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: fileIds.length > 0 ? "gpt-4o" : "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiResponse = completion.choices[0]?.message?.content || "";

      // Clean up uploaded files from OpenAI
      for (const fileId of fileIds) {
        try {
          await openai.files.delete(fileId);
          logger.info(`Deleted file from OpenAI: ${fileId}`);
        } catch (error) {
          logger.warn(`Failed to delete file ${fileId} from OpenAI:`, error);
          // Don't fail the request if cleanup fails
        }
      }

      if (!aiResponse) {
        throw new HttpsError("internal", "Failed to get response from OpenAI");
      }

      // Extract updated document from AI response
      // Look for the structured format: UPDATED_DOCUMENT_START ... UPDATED_DOCUMENT_END
      let letterUpdate = null;
      let cleanResponse = aiResponse;
      
      const documentMatch = aiResponse.match(/UPDATED_DOCUMENT_START\s*([\s\S]*?)\s*UPDATED_DOCUMENT_END/i);
      
      if (documentMatch && documentMatch[1]) {
        letterUpdate = documentMatch[1].trim();
        // Remove the document content from the response - keep only the confirmation message
        cleanResponse = aiResponse.replace(/UPDATED_DOCUMENT_START[\s\S]*?UPDATED_DOCUMENT_END/i, '').trim();
        logger.info(`Extracted updated document from structured format for user ${userId}`);
      } else {
        // Fallback: Look for updated document in other formats
        // Format 1: Markdown code block
        const codeBlockMatch = aiResponse.match(/```(?:html|text|markdown)?\s*([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].length > 50) {
          letterUpdate = codeBlockMatch[1].trim();
          // Remove code block from response
          cleanResponse = aiResponse.replace(/```[\s\S]*?```/g, '').trim();
          logger.info(`Extracted updated document from code block for user ${userId}`);
        }
        
        // Format 2: If response contains HTML tags and is substantial
        if (!letterUpdate && (aiResponse.includes('<p>') || aiResponse.includes('<div>'))) {
          const htmlMatch = aiResponse.match(/(<[^>]+>[\s\S]*<\/[^>]+>)/);
          if (htmlMatch && htmlMatch[1].length > 50) {
            letterUpdate = htmlMatch[1].trim();
            // Remove HTML content from response, keep text before it
            cleanResponse = aiResponse.replace(/(<[^>]+>[\s\S]*<\/[^>]+>)/, '').trim();
            logger.info(`Extracted updated document from HTML content for user ${userId}`);
          }
        }
      }

      // If we found an update, use it
      if (letterUpdate && letterUpdate.length > 50) {
        updatedLetter = letterUpdate;
        logger.info(`Document updated by AI for user ${userId}, length: ${updatedLetter.length}`);
      } else {
        logger.info(`No document update detected in AI response for user ${userId}`);
      }

      // Clean up the response - remove any remaining document content
      // If response is too long, it might contain document content
      if (cleanResponse.length > 500) {
        // Try to extract just the confirmation part (usually at the beginning or end)
        const lines = cleanResponse.split('\n');
        const confirmationLines = lines.filter(line => 
          line.length < 200 && 
          !line.includes('<p>') && 
          !line.includes('<div>') &&
          (line.toLowerCase().includes('updated') || 
           line.toLowerCase().includes('changed') || 
           line.toLowerCase().includes('sorry') ||
           line.toLowerCase().includes('couldn\'t') ||
           line.toLowerCase().includes('clarify'))
        );
        if (confirmationLines.length > 0) {
          cleanResponse = confirmationLines.join('\n').trim();
        } else {
          // Just take first few lines that aren't HTML
          cleanResponse = lines.slice(0, 3).filter(l => !l.includes('<')).join('\n').trim();
        }
      }

      logger.info(`Chat response generated for user ${userId}`);
      return {
        response: cleanResponse || "I've updated the document.",
        letterUpdate: updatedLetter !== currentLetter ? updatedLetter : undefined,
      };
    } catch (error) {
      logger.error("Error in chat with AI:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to chat with AI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Streaming version of chatWithAI - provides real-time updates
 */
export const chatWithAIStream = onRequest(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "512MiB",
    cors: true,
  },
  async (request, response) => {
    // Set CORS headers
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Declare variables outside try block so they're accessible in catch
    const openai = getOpenAIClient();
    const fileIds: string[] = [];
    const fileIdToName: Map<string, string> = new Map();
    
    try {
      const { message, sourceDocumentIds, conversationHistory, currentLetter, authToken, isTemplateMode } = request.body;

      if (!message || typeof message !== "string") {
        response.status(400).json({ error: "message is required" });
        return;
      }

      // Verify auth token
      if (!authToken) {
        response.status(401).json({ error: "Authentication required" });
        return;
      }

      let userId: string;
      try {
        const decodedToken = await adminAuth.verifyIdToken(authToken);
        userId = decodedToken.uid;
      } catch (error) {
        logger.warn("Invalid auth token:", error);
        response.status(401).json({ error: "Invalid authentication token" });
        return;
      }

      logger.info(`Streaming chat request from user ${userId}`);

      // Store sourceDocumentIds for potential use by tools (don't process yet)
      const availableSourceDocumentIds = sourceDocumentIds && Array.isArray(sourceDocumentIds) ? sourceDocumentIds : [];

      // Build document context - but don't upload PDFs yet, let AI decide
      let documentContext = "";
      if (availableSourceDocumentIds.length > 0) {
        documentContext = `\n\nYou have access to ${availableSourceDocumentIds.length} source document(s) that can be read if needed. Use the read_pdfs tool when you need information from these documents.`;
      }

      // Define tools for AI to decide when to read PDFs
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined = availableSourceDocumentIds.length > 0 ? [
        {
          type: "function",
          function: {
            name: "read_pdfs",
            description: "Read PDF documents to extract information. Use this when the user asks about information from documents, needs data extracted, wants to generate a letter from PDFs, or asks questions about document content. DO NOT use this for simple edits like 'change date', 'make it formal', 'update name' - those don't need PDF reading.",
            parameters: {
              type: "object",
              properties: {
                reason: {
                  type: "string",
                  description: "Why you need to read the PDFs (e.g., 'user asked about information in documents', 'need to extract data for letter generation', 'user asked what the PDF says')"
                }
              },
              required: ["reason"]
            }
          }
        }
      ] : undefined;

      // Build conversation messages
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a legal assistant helping to draft and refine demand letters. 
          
          CRITICAL RULES:
          1. You ONLY work on the document. All your actions modify the document, not the chat.
          2. When the user gives a COMMAND or INSTRUCTION, IMMEDIATELY update the document:
             - Examples: "change phone number", "update name", "make it more formal", "make it casual", "change tone", "change format", "make it professional", "make it friendly", etc.
             - IMMEDIATELY update the document with the changes
             - DO NOT respond in chat with explanations or questions
             - DO NOT ask "what do you want to change?" - just make the change
             - DO NOT ask for clarification - interpret the command and execute it
             - For style/tone changes: rewrite the document in the requested style (formal, casual, professional, friendly, etc.)
             - DO NOT ask for information - just use bracket placeholders like [client name], [date], [email], [phone number], etc.
             - Return the updated document in UPDATED_DOCUMENT_START/END format
             - After UPDATED_DOCUMENT_END, provide ONLY a brief confirmation (1 sentence max) like "I've updated the document to be more formal." or "I've changed the tone to casual."
          3. When the user asks a QUESTION (like "what is this?", "explain", "how does this work?", etc.):
             - You can respond in chat to answer the question
             - But still focus on the document context
          4. For "create doc" commands:
             - IMMEDIATELY create a demand letter template with bracket placeholders for ANY missing information
             - Use simple bracket notation: [client name], [date], [recipient name], [amount], [address], [phone number], [email], [deadline], [law firm name], [case number], etc.
             - If ANY information is missing, use [something] format (e.g., [email], [phone], [address], [date])
             - DO NOT ask questions - just create it with placeholders
             - Return it in UPDATED_DOCUMENT_START/END format
          
          FORMATTING RULES:
          - Output ONLY clean HTML format (use <p>, <strong>, <em>, <u> tags)
          - DO NOT use markdown syntax (no **, __, ---, #, etc.)
          - DO NOT add comments, instructions, or notes in the document
          - DO NOT include text like "Please ensure all provided details are accurate" or "Please complete any placeholders"
          - Use <strong> for bold, <em> for italic, <u> for underline
          - Use <p> tags for paragraphs
          - The document should contain ONLY the actual letter content, nothing else
          
          ${documentContext}`,
        },
      ];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current letter context if provided
      if (currentLetter) {
        const isTemplate = (isTemplateMode as boolean) === true;
        const documentType = isTemplate ? "template" : "document";
        
        messages.push({
          role: "system",
          content: `You are working with an EXISTING ${documentType}. When the user gives ANY command or instruction, you must UPDATE the existing ${documentType} content - DO NOT create a new ${documentType}.

Current ${documentType} content:
${currentLetter}

CRITICAL INSTRUCTIONS:
1. You are EDITING an EXISTING ${documentType}, NOT creating a new one.
2. ALL user commands must result in UPDATING the existing ${documentType}:
   - When user says "add [something]" or "I want to add [something]": ADD it to the existing ${documentType}, keeping all existing content
   - When user says "change [something]" or "update [something]": MODIFY the existing content
   - Specific changes: "change phone number to X", "update name to Y", "change date to Z", "add kids name"
   - Style/tone changes: "make it more formal", "make it casual", "change tone", "change format", "make it professional", "make it friendly"
   - For style changes: REWRITE the entire ${documentType} in the requested style while keeping all factual information and structure
   - For additions: ADD the requested elements (like placeholders for kids' names) to the existing ${documentType} structure
3. DO NOT create a new ${documentType} - always UPDATE the existing one
4. DO NOT ask for clarification - interpret the command and execute it
5. DO NOT say "I've created a new ${documentType}" - you are UPDATING the existing one
6. Find the relevant text in the ${documentType} (look for placeholders like [phone number] or actual existing text)
7. For additions: Add new placeholders or sections while preserving all existing content
8. Replace or add content as needed, but always return the COMPLETE updated ${documentType}
9. You MUST return the COMPLETE updated ${documentType} in this exact format (this will be extracted automatically, not shown to user):

UPDATED_DOCUMENT_START
[put the complete updated ${documentType} content here - include ALL existing content plus any additions/changes]
UPDATED_DOCUMENT_END

10. After the UPDATED_DOCUMENT_END, provide ONLY a simple confirmation message (1 sentence max):
   - If successful: "I've updated the ${documentType} to add [thing]." or "I've added [thing] to the ${documentType}." or "I've changed the ${documentType} to be more [style]."
   - NEVER say "I've created" - always say "I've updated" or "I've added"
   - NEVER ask for clarification - always make a change

DO NOT repeat the ${documentType} content in your confirmation. Keep it short and simple.`,
        });
      }

      // Add user message (without PDFs initially - AI will decide if needed)
      messages.push({
        role: "user",
        content: message,
      });

      // Set up Server-Sent Events
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      // Update system message to include tool decision instructions
      if (messages[0]?.role === "system" && typeof messages[0].content === "string") {
        messages[0].content = messages[0].content.replace(
          "CRITICAL RULES:\n          1. You ONLY work on the document.",
          "CRITICAL RULES:\n          1. You ONLY work on the document.\n          2. DECIDE WHEN TO READ PDFs (if read_pdfs tool is available):\n             - Use read_pdfs tool ONLY when you need information from documents:\n               * User asks \"what does the PDF say\", \"extract information\", \"generate letter\", \"create letter\", \"read the document\"\n               * User asks about specific information that might be in PDFs\n               * User wants to generate a new letter from source documents\n             - DO NOT use read_pdfs for simple edits:\n               * \"change date\", \"update name\", \"make it formal\", \"change tone\", \"fix typo\"\n               * These edits work with the current document content only"
        );
        // Renumber remaining rules
        messages[0].content = messages[0].content.replace(
          "          2. When the user gives",
          "          3. When the user gives"
        );
        messages[0].content = messages[0].content.replace(
          "          3. When the user asks",
          "          4. When the user asks"
        );
        messages[0].content = messages[0].content.replace(
          "          4. For \"create doc\"",
          "          5. For \"create doc\""
        );
      }

      // First, check if AI wants to use tools (non-streaming call)
      let needsPDFs = false;
      if (availableSourceDocumentIds.length > 0 && tools) {
        try {
          const toolCheck = await openai.chat.completions.create({
            model: "gpt-4o",
            messages,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 50, // Just enough to see if tool is called
          });

          const toolCalls = toolCheck.choices[0]?.message?.tool_calls;
          if (toolCalls && 
              toolCalls.length > 0 &&
              toolCalls[0].type === 'function' &&
              'function' in toolCalls[0] &&
              toolCalls[0].function.name === 'read_pdfs') {
            needsPDFs = true;
            logger.info("AI decided to read PDFs - processing documents");
            
            // Download PDFs from Storage and upload to OpenAI
            for (const docId of availableSourceDocumentIds) {
              try {
                const docRef = db.collection("sourceDocuments").doc(docId);
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                  const docData = docSnap.data();
                  if (docData?.storagePath) {
                    const documentName = docData.name || docId;
                    
                    // Download PDF from Storage
                    const bucket = storage.bucket();
                    const file = bucket.file(docData.storagePath);
                    const [fileBuffer] = await file.download();

                    // Create a proper Readable stream from Buffer
                    const fileStream = new Readable();
                    fileStream.push(fileBuffer);
                    fileStream.push(null);
                    
                    // Create a File-like object
                    const fileName = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;
                    const fileLike = Object.assign(fileStream, {
                      name: fileName,
                      type: 'application/pdf',
                    }) as any;
                    
                    // Upload to OpenAI Files API
                    const fileResponse = await openai.files.create({
                      file: fileLike,
                      purpose: 'user_data',
                    });

                    fileIds.push(fileResponse.id);
                    fileIdToName.set(fileResponse.id, documentName);
                    logger.info(`Uploaded document ${documentName} to OpenAI (file_id: ${fileResponse.id})`);
                  }
                }
              } catch (error) {
                logger.warn(`Failed to process document ${docId}:`, error);
              }
            }

            // Add PDFs to user message
      if (fileIds.length > 0) {
        const documentList = fileIds.map((fileId, index) => {
          const docName = fileIdToName.get(fileId) || `Document ${index + 1}`;
          return `Document ${index + 1}: "${docName}" (file_id: ${fileId})`;
        }).join('\n');
        
        const userContent: any[] = [
          {
            type: "text",
            text: `${message}

IMPORTANT: You have ${fileIds.length} PDF document(s) attached. You MUST read these PDF files to extract information before responding.

Attached documents:
${documentList}

CRITICAL: Read the attached PDF files to extract the actual information. Use real data from the documents, not placeholders.`,
          },
        ];
              
              // Add file references
        for (const fileId of fileIds) {
          userContent.push({
            type: "file",
            file: {
              file_id: fileId,
            },
          });
        }

              // Replace last user message with one that includes PDFs
              messages[messages.length - 1] = {
          role: "user",
          content: userContent,
              };
            }
          }
        } catch (error) {
          logger.warn("Error checking for tool usage, proceeding without PDFs:", error);
        }
      }

      // Now stream the actual response
      const stream = await openai.chat.completions.create({
        model: needsPDFs ? "gpt-4o" : "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });

      let fullResponse = "";
      let documentBuffer = "";
      let inDocumentBlock = false;
      let confirmationMessage = "";
      let pendingMessageChunks = ""; // Buffer for message chunks before we know if they're part of markers

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          
          // Check if we're entering document block
          if (fullResponse.includes("UPDATED_DOCUMENT_START") && !inDocumentBlock) {
            inDocumentBlock = true;
            const startIndex = fullResponse.indexOf("UPDATED_DOCUMENT_START");
            documentBuffer = fullResponse.substring(startIndex + "UPDATED_DOCUMENT_START".length);
            // Clear any pending message chunks that were part of the marker
            pendingMessageChunks = "";
          }

          // If in document block, accumulate document content
          if (inDocumentBlock) {
            if (fullResponse.includes("UPDATED_DOCUMENT_END")) {
              const endIndex = fullResponse.indexOf("UPDATED_DOCUMENT_END");
              documentBuffer = fullResponse.substring(
                fullResponse.indexOf("UPDATED_DOCUMENT_START") + "UPDATED_DOCUMENT_START".length,
                endIndex
              ).trim();
              // Remove leading/trailing newlines and empty paragraphs
              documentBuffer = documentBuffer.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
              // Remove leading/trailing empty HTML paragraphs if present
              documentBuffer = documentBuffer.replace(/^<p>\s*<\/p>\s*/i, '').replace(/\s*<p>\s*<\/p>$/i, '');
              inDocumentBlock = false;
              confirmationMessage = fullResponse.substring(endIndex + "UPDATED_DOCUMENT_END".length).trim();
              
              // Send document update
              response.write(`data: ${JSON.stringify({ type: 'document', content: documentBuffer })}\n\n`);
            } else {
              // Still building document - send partial update (but don't send to chat)
              const currentDoc = fullResponse.substring(
                fullResponse.indexOf("UPDATED_DOCUMENT_START") + "UPDATED_DOCUMENT_START".length
              );
              response.write(`data: ${JSON.stringify({ type: 'document_partial', content: currentDoc })}\n\n`);
            }
          } else {
            // Not in document block yet - check if we're building up to the marker
            // If fullResponse contains part of "UPDATED_DOCUMENT_START", don't send to chat yet
            const markerStart = "UPDATED_DOCUMENT_START";
            const currentMarkerProgress = markerStart.substring(0, Math.min(fullResponse.length, markerStart.length));
            
            if (fullResponse.endsWith(currentMarkerProgress) || fullResponse.includes("UPDATED_DOCUMENT")) {
              // We're building up to or have the marker - don't send to chat
              // Just accumulate in pendingMessageChunks but don't send
              pendingMessageChunks += content;
            } else {
              // Safe to send - not part of marker
              // Send any pending chunks first, then current chunk
              if (pendingMessageChunks) {
                response.write(`data: ${JSON.stringify({ type: 'message', content: pendingMessageChunks })}\n\n`);
                pendingMessageChunks = "";
              }
              response.write(`data: ${JSON.stringify({ type: 'message', content })}\n\n`);
            }
          }
        }
      }

      // Finalize: send complete document if we have it, or clean response
      if (documentBuffer && documentBuffer.length > 50) {
        // Clean up document buffer - remove leading/trailing whitespace and newlines
        let cleanedBuffer = documentBuffer.trim();
        cleanedBuffer = cleanedBuffer.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
        cleanedBuffer = cleanedBuffer.replace(/^<p>\s*<\/p>\s*/i, '').replace(/\s*<p>\s*<\/p>$/i, '');
        response.write(`data: ${JSON.stringify({ type: 'document_final', content: cleanedBuffer })}\n\n`);
      }

      // Send final confirmation message (cleaned)
      let finalMessage = confirmationMessage || fullResponse;
      
      // Clean up if it contains document markers
      if (finalMessage.includes("UPDATED_DOCUMENT_START")) {
        finalMessage = finalMessage.replace(/UPDATED_DOCUMENT_START[\s\S]*?UPDATED_DOCUMENT_END/i, '').trim();
      }

      // If response is too long, extract just confirmation
      if (finalMessage.length > 500) {
        const lines = finalMessage.split('\n');
        const confirmationLines = lines.filter(line => 
          line.length < 200 && 
          !line.includes('<p>') && 
          !line.includes('<div>') &&
          (line.toLowerCase().includes('updated') || 
           line.toLowerCase().includes('changed') || 
           line.toLowerCase().includes('sorry') ||
           line.toLowerCase().includes('couldn\'t') ||
           line.toLowerCase().includes('clarify'))
        );
        if (confirmationLines.length > 0) {
          finalMessage = confirmationLines.join('\n').trim();
        }
      }

      response.write(`data: ${JSON.stringify({ type: 'message_final', content: finalMessage || "I've updated the document." })}\n\n`);
      response.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      
      // Clean up uploaded files from OpenAI
      for (const fileId of fileIds) {
        try {
          await openai.files.delete(fileId);
          logger.info(`Deleted file from OpenAI: ${fileId}`);
        } catch (error) {
          logger.warn(`Failed to delete file ${fileId} from OpenAI:`, error);
          // Don't fail the request if cleanup fails
        }
      }
      
      response.end();

    } catch (error) {
      logger.error("Error in streaming chat:", error);
      
      // Clean up uploaded files even on error
      for (const fileId of fileIds) {
        try {
          await openai.files.delete(fileId);
          logger.info(`Deleted file from OpenAI after error: ${fileId}`);
        } catch (cleanupError) {
          logger.warn(`Failed to delete file ${fileId} from OpenAI:`, cleanupError);
        }
      }
      
      response.write(`data: ${JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : String(error) })}\n\n`);
      response.end();
    }
  }
);

