import { client, model } from "./client";
import * as fs from 'fs'
import { censorPII } from "pii-paladin";
// @ts-ignore: tesseract.js has no bundled types in this project
import { createWorker } from 'tesseract.js';

// Check if the current screenshot shows a decision
export async function checkForDecision(imgPath: string) {
    if (!fs.existsSync(imgPath)) {
        throw new Error(`Image not found at path: ${imgPath}`);
    }
    
    const worker = await createWorker('eng');

    const {
        data: { text }
    } = await worker.recognize(imgPath);

    await worker.terminate();
    
    try {
        fs.writeFileSync(`${imgPath}_ocr.txt`, text, 'utf8');
    }
    catch (err) {
        console.warn('Could not write OCR text to disk:', err);
    }
    
    const systemPrompt = `You are a classifier to identify if the ACTUAL admission decision is clearly visible on this page.

Only return a decision if you see the ACTUAL decision statement (e.g., "Your application has been accepted", "We regret to inform you that you have been rejected", "You have been placed on the waitlist", "Your decision has been deferred").

If you see:
- Just status updates or notifications (e.g., "An update to your application was posted") → respond "NONE"
- Just navigation hints (e.g., "View your decision") → respond "NONE"
- The word "deferred", "accepted", "rejected", or "waitlisted" in the context of the ACTUAL decision → respond with that word (lowercase)

Respond with ONLY: "accepted", "rejected", "waitlisted", "deferred", or "NONE".`;

    const response = await client.chat.completions.create({
        model: model as string,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the OCR output:\n\n${await censorPII(text)}` }
        ],
    });

    return {
        ocrText: text,
        clientResponse: response.choices[0].message
    };
}

// Find the next button/link to click to reach the decision
export async function findNextAction(imgPath: string) {
    if (!fs.existsSync(imgPath)) {
        throw new Error(`Image not found at path: ${imgPath}`);
    }

    const worker = await createWorker('eng');

    const {
        data: { text }
    } = await worker.recognize(imgPath);

    await worker.terminate();

    try {
        fs.writeFileSync(`${imgPath}_ocr.txt`, text, 'utf8');
    } catch (err) {
        console.warn('Could not write OCR text to disk:', err);
    }

    const systemPrompt = `You are helping navigate a college application portal to find the admission decision. Your goal is to guide the user through the portal step by step.

Look at the page text and identify the EXACT text of the next button or link to click. Follow this priority:
1. First, look for buttons to OPEN or VIEW the application (e.g., "Open Application", "View Application", "[College Name]", application names, "2026 Early Decision")
2. Then, look for buttons/links related to DECISIONS or UPDATES (e.g., "View Update", "Review Decision", "Check Status", "Decision Letter", "View Decision", "Status Update", "Application Decision")
3. Look for expandable sections or tabs (e.g., "+", "Show Details", "Expand", "Decision", "Updates")
4. If you see an "Application Checklist" or similar page with no decision-related buttons, respond with "NONE"

Respond with ONLY the exact button/link text. If no relevant button/link is found or we're on a checklist page without decision info, respond with "NONE".`;

    const response = await client.chat.completions.create({
        model: model as string,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the OCR output:\n\n${await censorPII(text)}` }
        ],
    });

    return {
        ocrText: text,
        clientResponse: response.choices[0].message
    };
}

// Legacy functions kept for compatibility
export async function identifyDecision() {
    return checkForDecision('decision.png');
}

export async function findText() {
    return findNextAction('dashboard.png');
}