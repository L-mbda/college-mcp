import { getDecision } from "./main";
import { collegeProviders } from "./providers";

console.log("Starting college application automation...");

for (const provider of collegeProviders) {
    console.log(`Processing provider: `);
    try {
        const decision = await getDecision(provider.url, provider.email, provider.password);
        if (decision == "NOT_FOUND") {
            console.log(`Decision not found for provider `);
        }
    }
    catch (err) {
        console.error(`Error processing provider :`, err);
    }
}

console.log("College application automation completed.");