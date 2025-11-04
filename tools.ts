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
    
    const systemPrompt = 'You are a classifier to identify if the application decision is visible on this page. If you see "accepted", "rejected", "waitlisted", or "deferred", respond with ONLY that word (lowercase). If no decision is visible, respond with "NONE".';

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

    const systemPrompt = 'You are helping navigate a college application portal to find the admission decision. Look at the page text and identify the EXACT text of the button or link that should be clicked to view the decision (e.g., "View Update", "Review Decision", "Check Status", etc.). Respond with ONLY the exact button/link text. If no relevant button/link is found, respond with "NONE".';

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