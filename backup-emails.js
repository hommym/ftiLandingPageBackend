const fs = require("fs").promises;
const path = require("path");
const https = require("https");

// Configuration
const API_ENDPOINT = "https://ftilandingpagebackend.onrender.com/api/emails";
const BACKUP_DIR = path.join(__dirname, "email-backups");

/**
 * Fetch data from the API endpoint
 */
async function fetchEmails() {
  return new Promise((resolve, reject) => {
    https
      .get(API_ENDPOINT, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        });
      })
      .on("error", (error) => {
        reject(new Error(`HTTP request failed: ${error.message}`));
      });
  });
}

/**
 * Generate filename with timestamp
 * Format: emails_2026-02-12_14-30-45.json
 */
function generateFilename() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `emails_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Save data to timestamped JSON file
 */
async function saveBackup(data) {
  await ensureBackupDir();

  const filename = generateFilename();
  const filepath = path.join(BACKUP_DIR, filename);

  await fs.writeFile(filepath, JSON.stringify(data, null, 2));

  return { filename, filepath };
}

/**
 * Main backup function
 */
async function backupEmails() {
  console.log("🔄 Starting email backup...");
  console.log(`📡 Fetching from: ${API_ENDPOINT}`);

  try {
    // Fetch emails from API
    const data = await fetchEmails();

    console.log(`📧 Found ${data.count} email(s)`);

    // Save to timestamped file
    const { filename, filepath } = await saveBackup(data);

    console.log(`✅ Backup saved: ${filename}`);
    console.log(`📁 Full path: ${filepath}`);
    console.log("✅ Backup completed successfully!");

    return {
      success: true,
      filename,
      count: data.count,
    };
  } catch (error) {
    console.error("❌ Backup failed:", error.message);
    throw error;
  }
}

// Run the backup if this script is executed directly
if (require.main === module) {
  backupEmails()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { backupEmails };
