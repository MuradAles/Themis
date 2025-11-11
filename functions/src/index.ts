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
import {onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import {Document, Packer, Paragraph, TextRun} from "docx";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Define secrets
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || openaiApiKey.value();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
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
        throw new Error("sourceDocumentIds array is required");
      }

      if (!request.auth) {
        throw new Error("Authentication required");
      }

      const userId = request.auth.uid;
      logger.info(`Generating letter for user ${userId} with ${sourceDocumentIds.length} source documents`);

      // Read extracted text from Firestore
      const documentTexts: string[] = [];
      for (const docId of sourceDocumentIds) {
        const docRef = db.collection("sourceDocuments").doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new Error(`Source document ${docId} not found`);
        }

        const docData = docSnap.data();
        if (!docData || !docData.extractedText) {
          throw new Error(`Source document ${docId} has no extracted text`);
        }

        documentTexts.push(`--- Document: ${docData.name || docId} ---\n${docData.extractedText}\n`);
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
            The letter should be:
            - Clear and professional in tone
            - Well-structured with proper legal formatting
            - Based on the facts and information in the source documents
            - Appropriate for legal correspondence`,
          },
          {
            role: "user",
            content: `Please generate a demand letter based on the following source documents:\n\n${combinedText}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const generatedLetter = completion.choices[0]?.message?.content || "";

      if (!generatedLetter) {
        throw new Error("Failed to generate letter from OpenAI");
      }

      logger.info(`Successfully generated letter for user ${userId}`);
      return {letter: generatedLetter};
    } catch (error) {
      logger.error("Error generating letter:", error);
      throw new Error(`Failed to generate letter: ${error}`);
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
        throw new Error("letter content is required");
      }

      if (!instruction || typeof instruction !== "string") {
        throw new Error("refinement instruction is required");
      }

      if (!request.auth) {
        throw new Error("Authentication required");
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
        throw new Error("Failed to refine letter from OpenAI");
      }

      logger.info(`Successfully refined letter for user ${userId}`);
      return {letter: refinedLetter};
    } catch (error) {
      logger.error("Error refining letter:", error);
      throw new Error(`Failed to refine letter: ${error}`);
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
        throw new Error("message is required");
      }

      if (!request.auth) {
        throw new Error("Authentication required");
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
      if (currentLetter) {
        messages.push({
          role: "system",
          content: `Current letter content:\n${currentLetter}`,
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
        max_tokens: 1500,
      });

      const aiResponse = completion.choices[0]?.message?.content || "";

      if (!aiResponse) {
        throw new Error("Failed to get response from OpenAI");
      }

      // Check if AI suggests letter updates
      let letterUpdate = null;
      if (aiResponse.toLowerCase().includes("here's the updated letter") ||
          aiResponse.toLowerCase().includes("updated letter:")) {
        // Extract letter content if AI provided it
        const letterMatch = aiResponse.match(/```[\s\S]*?```|(?:letter|content):\s*([\s\S]+)/i);
        if (letterMatch) {
          letterUpdate = letterMatch[1] || letterMatch[0];
        }
      }

      logger.info(`Chat response generated for user ${userId}`);
      return {
        response: aiResponse,
        letterUpdate: letterUpdate || undefined,
      };
    } catch (error) {
      logger.error("Error in chat with AI:", error);
      throw new Error(`Failed to chat with AI: ${error}`);
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
        throw new Error("letter content is required");
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
      throw new Error(`Failed to export to Word: ${error}`);
    }
  }
);
