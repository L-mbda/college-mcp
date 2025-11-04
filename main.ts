import { Builder, until, By } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import { writeFileSync } from "fs";
import { findNextAction, checkForDecision } from "./tools";

export async function getDecision(URL: string, email: string, password: string) {
  const options = new chrome.Options();
  options.setChromeBinaryPath("/usr/bin/google-chrome");
  options.addArguments("--headless=new");
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--disable-gpu");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(URL);
    
    await driver.wait(async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "complete";
    }, 10000);
    
    //   Authentication
    const emailField = await driver.findElement(By.css('input[type="email"], input[name*="email" i], input[id*="email" i]'));
    await emailField.sendKeys(email);  
    const passwordField = await driver.findElement(By.css('input[type="password"]'));
    await passwordField.sendKeys(password);
    
    await passwordField.sendKeys("\n");
    
    await driver.wait(async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "complete";
    }, 60000);
    
    console.log("Logged in successfully");
    
    // Loop: Take screenshot, send to LLM, click, repeat until decision found
    let maxIterations = 10;
    let iteration = 0;
    let decisionFound = false;
    let finalDecision = "NOT_FOUND";
    
    while (!decisionFound && iteration < maxIterations) {
      iteration++;
      console.log(`\n=== Iteration ${iteration} ===`);
      
      // Get full page height and take screenshot
      const height = await driver.executeScript("return document.body.scrollHeight") as number;
      await driver.manage().window().setRect({ width: 1920, height: height });
      
      const screenshot = await driver.takeScreenshot();
      const screenshotFilename = `screenshot_${iteration}.png`;
      writeFileSync(screenshotFilename, screenshot, "base64");
      console.log(`Screenshot saved: ${screenshotFilename}`);
      
      // First, ask LLM what to click next (prioritize navigation)
      const nextAction = await findNextAction(screenshotFilename);
      const textToClick = nextAction.clientResponse.content?.trim() || "";
      
      console.log(`LLM suggests clicking: "${textToClick}"`);
      
      // If there's a button to click, click it (don't check for decision yet)
      if (textToClick !== "NONE" && textToClick !== "NOT_FOUND" && textToClick !== "") {
        // Find and click the element
        let buttonToClick;
        try {
          // Strategy 1: Try exact text match with normalize-space
          const normalizedText = textToClick.replace(/\s+/g, ' ').trim();
          buttonToClick = await driver.findElement(
            By.xpath(`//button[normalize-space(.)='${normalizedText}'] | //a[normalize-space(.)='${normalizedText}']`)
          );
        } catch (e) {
          try {
            // Strategy 2: Try partial text match
            const searchText = textToClick.split(' ')[0]; // Use first word
            buttonToClick = await driver.findElement(
              By.xpath(`//button[contains(., '${searchText}')] | //a[contains(., '${searchText}')]`)
            );
          } catch (e2) {
            console.log(`Could not find element with text: ${textToClick}`);
            // Check for decision before giving up
            const decisionCheck = await checkForDecision(screenshotFilename);
            const decision = decisionCheck.clientResponse.content?.trim().toLowerCase();
            
            if (decision && ['accepted', 'rejected', 'waitlisted', 'deferred'].includes(decision)) {
              console.log(`Decision found: ${decision}`);
              finalDecision = decision;
              decisionFound = true;
            } else {
              finalDecision = "NOT_FOUND";
            }
            break;
          }
        }
        
        await buttonToClick.click();
        console.log("Button clicked");
        
        // Wait for page to load after click
        await driver.wait(async () => {
          const readyState = await driver.executeScript("return document.readyState");
          return readyState === "complete";
        }, 60000);
        
        // Small delay to let any animations complete
        await driver.sleep(1000);
      } else {
        // No more navigation buttons, check for decision
        console.log("No navigation button found. Checking for decision...");
        const decisionCheck = await checkForDecision(screenshotFilename);
        const decision = decisionCheck.clientResponse.content?.trim().toLowerCase();
        
        if (decision && ['accepted', 'rejected', 'waitlisted', 'deferred'].includes(decision)) {
          console.log(`Decision found: ${decision}`);
          finalDecision = decision;
          decisionFound = true;
        } else {
          console.log("No decision found on portal.");
          finalDecision = "NOT_FOUND";
          break;
        }
      }
    }
    
    if (iteration >= maxIterations) {
      console.log("Max iterations reached without finding decision");
    }
    
    return finalDecision;
    
  } finally {
    await driver.quit();
  }
}
