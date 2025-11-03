import { client, model } from "./client";
import * as fs from 'fs'
import { censorPII } from "pii-paladin";
// @ts-ignore: tesseract.js has no bundled types in this project
import { createWorker } from 'tesseract.js';

export async function identifyDecision() {
    const imgPath = 'decision.png';
    if (!fs.existsSync(imgPath)) {
        throw new Error(`Image not found at path: ${imgPath}`);
    }
    
    // Create worker without logger to avoid DataCloneError in Bun/Node
    const worker = await createWorker('eng');

    const {
        data: { text }
    } = await worker.recognize(imgPath);

    await worker.terminate();
    
    // Save raw OCR text for debugging
    try {
        fs.writeFileSync('decision_ocr.txt', text, 'utf8');
    }
    catch (err) {
        // non-fatal
        console.warn('Could not write OCR text to disk:', err);
    }
    
    // Send OCR text to the client for extraction/interpretation
    const systemPrompt = 'You are a classifier to identify if the application decision is "accepted", "rejected", "waitlisted", or "deferred". Respond with ONLY one of these four words.';

    const response = await client.chat.completions.create({
        model: model as string,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the OCR output from decision.png:\n\n${await censorPII(text)}` }
        ],
    });

    return {
        ocrText: text,
        clientResponse: response.choices[0].message
    };
    
}


// OCR dashboard.png and send the extracted text to the client
export async function findText() {
    const imgPath = 'dashboard.png';
    if (!fs.existsSync(imgPath)) {
        throw new Error(`Image not found at path: ${imgPath}`);
    }

    // Create worker without logger to avoid DataCloneError in Bun/Node
    const worker = await createWorker('eng');

    const {
        data: { text }
    } = await worker.recognize(imgPath);

    await worker.terminate();

    // Save raw OCR text for debugging
    try {
        fs.writeFileSync('dashboard_ocr.txt', text, 'utf8');
    } catch (err) {
        // non-fatal
        console.warn('Could not write OCR text to disk:', err);
    }

    // Send OCR text to the client for extraction/interpretation
    const systemPrompt = 'You are a text identifier to identify the specific text for the button to find out the application decision. (e.g., "View Update", "Review Decision", etc.). Respond with ONLY the text for the specified button';

    const response = await client.chat.completions.create({
        model: model as string,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the OCR output from dashboard.png:\n\n${await censorPII(text)}` }
        ],
    });

    return {
        ocrText: text,
        clientResponse: response.choices[0].message
    };
}