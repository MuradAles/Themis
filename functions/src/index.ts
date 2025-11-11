/**
 * Firebase Functions for Themis - Demand Letter Generator
 * 
 * Functions:
 * - generateLetter: Generate demand letter from extracted text in Firestore
 * - refineLetter: Refine existing letter based on instructions
 * - chatWithAI: Chat interface with AI for letter editing
 * - exportToWord: Export letter to Word document format (direct download)
 */

import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {getAuth} from "firebase-admin/auth";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {Document, Packer, Paragraph, TextRun} from "docx";
const pdfParse = require("pdf-parse");

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
      const {sourceDocumentIds} = request.data;

      if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
        throw new HttpsError("invalid-argument", "sourceDocumentIds array is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Generating letter for user ${userId} with ${sourceDocumentIds.length} source documents`);

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

      // Extract text from PDFs
      const documentTexts: string[] = [];
      for (const pdf of pdfFiles) {
        try {
          const pdfData = await pdfParse(pdf.data);
          const extractedText = pdfData.text;
          documentTexts.push(`--- Document: ${pdf.name} ---\n${extractedText}\n`);
          logger.info(`Extracted text from ${pdf.name}: ${extractedText.length} characters`);
        } catch (error) {
          logger.error(`Failed to extract text from ${pdf.name}:`, error);
          // Continue with other documents even if one fails
          documentTexts.push(`--- Document: ${pdf.name} ---\n[Error: Could not extract text from this PDF]\n`);
        }
      }

      const combinedText = documentTexts.join("\n\n");

      // Call OpenAI to generate the letter
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a legal assistant specializing in drafting professional demand letters. 
            Analyze the provided source documents and generate a comprehensive, professional demand letter.
            
            CRITICAL RULES:
            1. Use ONLY information that is explicitly stated in the source documents
            2. If information is missing or unclear, use descriptive placeholders that tell the user what to fill in:
               - "Put your name here" or "Put client name here" for missing client/plaintiff name
               - "Put recipient name here" or "Put defendant name here" for missing defendant/recipient name
               - "Put date here" or "Put incident date here" for missing dates
               - "Put amount here" or "Put dollar amount here" for missing monetary amounts
               - "Put address here" for missing addresses
               - "Put case details here" for missing case-specific information
               - "Put reference number here" for missing reference numbers
               - "Put [specific information] here" format for any other missing information
            3. DO NOT fabricate, invent, or guess any information
            4. DO NOT make assumptions about missing details
            5. If a fact is not in the documents, use a descriptive placeholder that clearly indicates what needs to be filled in
            6. Placeholders should be clear instructions to the user, not just brackets
            
            The letter should be:
            - Clear and professional in tone
            - Well-structured with proper legal formatting
            - Based ONLY on facts from the source documents
            - Use placeholders for any missing information
            - Appropriate for legal correspondence`,
          },
          {
            role: "user",
            content: `Please generate a demand letter based on the following source documents. 
            Use ONLY information that is explicitly stated in these documents. 
            For any missing information, use descriptive placeholders that tell the user what to fill in, 
            like "Put your name here", "Put date here", "Put amount here", "Put address here", etc.
            DO NOT use bracket notation like [CLIENT NAME]. Instead, use clear instructions like "Put client name here".
            DO NOT make up or invent any information.\n\nSource Documents:\n\n${combinedText}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const generatedLetter = completion.choices[0]?.message?.content || "";

      if (!generatedLetter) {
        throw new HttpsError("internal", "Failed to generate letter from OpenAI");
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
      const {message, sourceDocumentIds, conversationHistory, currentLetter} = request.data;

      if (!message || typeof message !== "string") {
        throw new HttpsError("invalid-argument", "message is required");
      }

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Chat request from user ${userId}`);

      // Build context from documents if provided
      let documentContext = "";
      if (sourceDocumentIds && Array.isArray(sourceDocumentIds) && sourceDocumentIds.length > 0) {
        const documentTexts: string[] = [];
        for (const docId of sourceDocumentIds) {
          try {
            const docRef = db.collection("sourceDocuments").doc(docId);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
              const docData = docSnap.data();
              if (docData?.extractedText) {
                const text = docData.extractedText.substring(0, 1000);
                documentTexts.push(`--- Document: ${docData.name || docId} ---\n${text}...`);
              }
            }
          } catch (error) {
            logger.warn(`Failed to load document ${docId}:`, error);
          }
        }
        documentContext = "\n\nRelevant documents:\n" + documentTexts.join("\n\n");
      }

      // Build conversation messages
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a legal assistant helping to draft and refine demand letters. 
          You can answer questions about the documents, suggest improvements to the letter, 
          and help with legal writing.${documentContext}`,
        },
      ];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current letter context if provided
      let updatedLetter = currentLetter || "";
      if (currentLetter) {
        messages.push({
          role: "system",
          content: `You are working with this document. When the user asks to change, update, or provide information, you must actually modify the document content.

Current document content:
${currentLetter}

CRITICAL INSTRUCTIONS:
1. Understand what the user wants to change (phone number, name, address, law firm name, etc.)
2. Find the relevant text in the document (look for placeholders like "Put phone number here" or actual existing text)
3. Replace it with the new information the user provided
4. You MUST return the COMPLETE updated document in this exact format (this will be extracted automatically, not shown to user):

UPDATED_DOCUMENT_START
[put the complete updated document content here]
UPDATED_DOCUMENT_END

5. After the UPDATED_DOCUMENT_END, provide ONLY a simple confirmation message (1-2 sentences max):
   - If successful: "I've updated the [thing] to [value]." or "I've changed the [thing]."
   - If you couldn't find it: "Sorry, I couldn't find [thing] to update. Could you clarify where it should be?"
   - If you don't understand: "I'm not sure what you want to change. Could you clarify?"

DO NOT repeat the document content in your confirmation. Keep it short and simple.`,
        });
      }

      // Add user message
      messages.push({
        role: "user",
        content: message,
      });

      // Call OpenAI
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiResponse = completion.choices[0]?.message?.content || "";

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

    try {
      const { message, sourceDocumentIds, conversationHistory, currentLetter, authToken } = request.body;

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

      // Build context from documents if provided
      let documentContext = "";
      if (sourceDocumentIds && Array.isArray(sourceDocumentIds) && sourceDocumentIds.length > 0) {
        const documentTexts: string[] = [];
        for (const docId of sourceDocumentIds) {
          try {
            const docRef = db.collection("sourceDocuments").doc(docId);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
              const docData = docSnap.data();
              if (docData?.extractedText) {
                const text = docData.extractedText.substring(0, 1000);
                documentTexts.push(`--- Document: ${docData.name || docId} ---\n${text}...`);
              }
            }
          } catch (error) {
            logger.warn(`Failed to load document ${docId}:`, error);
          }
        }
        documentContext = "\n\nRelevant documents:\n" + documentTexts.join("\n\n");
      }

      // Build conversation messages
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are a legal assistant helping to draft and refine demand letters. 
          You can answer questions about the documents, suggest improvements to the letter, 
          and help with legal writing.${documentContext}`,
        },
      ];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory)) {
        messages.push(...conversationHistory);
      }

      // Add current letter context if provided
      if (currentLetter) {
        messages.push({
          role: "system",
          content: `You are working with this document. When the user asks to change, update, or provide information, you must actually modify the document content.

Current document content:
${currentLetter}

CRITICAL INSTRUCTIONS:
1. Understand what the user wants to change (phone number, name, address, law firm name, etc.)
2. Find the relevant text in the document (look for placeholders like "Put phone number here" or actual existing text)
3. Replace it with the new information the user provided
4. You MUST return the COMPLETE updated document in this exact format (this will be extracted automatically, not shown to user):

UPDATED_DOCUMENT_START
[put the complete updated document content here]
UPDATED_DOCUMENT_END

5. After the UPDATED_DOCUMENT_END, provide ONLY a simple confirmation message (1-2 sentences max):
   - If successful: "I've updated the [thing] to [value]." or "I've changed the [thing]."
   - If you couldn't find it: "Sorry, I couldn't find [thing] to update. Could you clarify where it should be?"
   - If you don't understand: "I'm not sure what you want to change. Could you clarify?"

DO NOT repeat the document content in your confirmation. Keep it short and simple.`,
        });
      }

      // Add user message
      messages.push({
        role: "user",
        content: message,
      });

      // Set up Server-Sent Events
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      // Call OpenAI with streaming
      const openai = getOpenAIClient();
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
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
      response.end();

    } catch (error) {
      logger.error("Error in streaming chat:", error);
      response.write(`data: ${JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : String(error) })}\n\n`);
      response.end();
    }
  }
);

/**
 * Task 2.4: Export to Word Function
 * Exports letter to Word document format (direct download, no Storage)
 */
export const exportToWord = onCall(
  {
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    try {
      const {letter, documentId, title} = request.data;

      if (!request.auth) {
        throw new Error("Authentication required");
      }

      const userId = request.auth.uid;
      let letterContent = letter;
      let documentTitle = title;

      // If documentId provided, read from Firestore
      if (documentId && !letterContent) {
        const docRef = db.collection("documents").doc(documentId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new Error(`Document ${documentId} not found`);
        }

        const docData = docSnap.data();
        if (!docData || !docData.content) {
          throw new Error(`Document ${documentId} has no content`);
        }

        letterContent = docData.content;
        if (!documentTitle && docData.title) {
          documentTitle = docData.title;
        }
      }

      if (!letterContent || typeof letterContent !== "string") {
        throw new HttpsError("invalid-argument", "letter content is required");
      }

      logger.info(`Exporting letter to Word for user ${userId}`);

      // Parse letter into paragraphs (split by double newlines)
      const paragraphs = letterContent
        .split(/\n\s*\n/)
        .filter((p) => p.trim().length > 0)
        .map((text) => {
          return new Paragraph({
            children: [
              new TextRun({
                text: text.trim(),
                size: 24, // 12pt
              }),
            ],
            spacing: {
              after: 200, // 10pt spacing after paragraph
            },
          });
        });

      // Create Word document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      // Generate document buffer
      const buffer = await Packer.toBuffer(doc);

      // Convert buffer to base64 for return
      const base64 = buffer.toString("base64");
      const fileName = `${documentTitle || "demand-letter"}-${Date.now()}.docx`;

      logger.info(`Word document created for user ${userId}: ${fileName}`);
      return {
        fileData: base64,
        fileName: fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    } catch (error) {
      logger.error("Error exporting to Word:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to export to Word: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
