import { Builder, until, By } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import { writeFileSync } from "fs";
import { findText, identifyDecision } from "./tools";
import { SyncRedactor } from "redact-pii";
import { censorPII } from "pii-paladin";

async function getDecision(URL: string, email: string, password: string) {
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
    
    const height = await driver.executeScript("return document.body.scrollHeight") as number;
    await driver.manage().window().setRect({ width: 1920, height: height });
    
    const screenshot = await driver.takeScreenshot();
    writeFileSync("dashboard.png", screenshot, "base64");
    console.log("Dashboard screenshot saved");
    
    // Use OCR to find the button text
    const classifyButton = await findText();
    const textToClick = classifyButton.clientResponse.content?.trim() || "";
    console.log("Button text to click:", textToClick);
    
    // Find and click the button/link - use a more robust approach
    // Try multiple strategies to find the element
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
        // Strategy 3: Find by common class/id patterns for decision buttons
        buttonToClick = await driver.findElement(
          By.css('button[class*="view"], button[class*="update"], a[class*="view"], a[class*="update"], .view-button, .update-button')
        );
      }
    }
    
    await buttonToClick.click();
    console.log("Button clicked");
    
    // Wait for the decision page to load
    await driver.wait(async () => {
      const readyState = await driver.executeScript("return document.readyState");
      return readyState === "complete";
    }, 60000);
    
    // Get full page height and take screenshot
    const decisionHeight = await driver.executeScript("return document.body.scrollHeight") as number;
    await driver.manage().window().setRect({ width: 1920, height: decisionHeight });  
    const decisionScreenshot = await driver.takeScreenshot();
    writeFileSync("decision.png", decisionScreenshot, "base64");
    console.log("Decision screenshot saved to decision.png");
    const finalDecision = await identifyDecision();
    return finalDecision.clientResponse.content;
  } finally {
    await driver.quit();
  }
}

await getDecision("https://ivyhub-simulators.andressevilla.com/uchicago/login.html", "e.r@e.com", "vcd@email.com");