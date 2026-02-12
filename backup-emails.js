const fs = require("fs").promises;
const path = require("path");
const https = require("https");

// Configuration
const API_ENDPOINT = "https://ftilandingpagebackend.onrender.com/api/emails";
const SCHEDULER_SECRET =
  process.env.SCHEDULER_SECRET || "your-secret-key-change-in-production";
const BACKUP_DIR = path.join(__dirname, "email-backups");

/**
 * Fetch data from the API endpoint with scheduler secret
 */
async function fetchEmails() {
  return new Promise((resolve, reject) => {
    const url = `${API_ENDPOINT}?secret=${encodeURIComponent(SCHEDULER_SECRET)}`;

    https
      .get(url, (res) => {
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
 * Get the most recent backup file
 */
async function getMostRecentBackup() {
  await ensureBackupDir();

  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter((file) => file.startsWith("emails_") && file.endsWith(".json"))
      .sort()
      .reverse(); // Most recent first

    if (backupFiles.length === 0) {
      return null;
    }

    const mostRecent = backupFiles[0];
    const filepath = path.join(BACKUP_DIR, mostRecent);

    try {
      const content = await fs.readFile(filepath, "utf8");
      const data = JSON.parse(content);

      return {
        filename: mostRecent,
        filepath: filepath,
        data: data,
      };
    } catch (error) {
      console.warn(
        `⚠️  Could not read recent backup ${mostRecent}:`,
        error.message,
      );
      return null;
    }
  } catch (error) {
    console.warn("⚠️  Could not list backup directory:", error.message);
    return null;
  }
}

/**
 * Save data to timestamped JSON file, appending to most recent backup
 */
async function saveBackup(newData) {
  await ensureBackupDir();

  // Get most recent backup
  const recentBackup = await getMostRecentBackup();

  let allEmails = [];
  let previousCount = 0;

  if (recentBackup) {
    // Append to existing data
    const previousEmails = recentBackup.data.emails || [];
    previousCount = previousEmails.length;

    // Combine previous emails with new ones
    allEmails = [...previousEmails, ...newData.emails];

    console.log(
      `📎 Found previous backup: ${recentBackup.filename} (${previousCount} emails)`,
    );
  } else {
    // No previous backup, use only new data
    allEmails = newData.emails;
    console.log("📝 No previous backup found, creating first backup");
  }

  // Create new backup with combined data
  const filename = generateFilename();
  const filepath = path.join(BACKUP_DIR, filename);

  const backupData = {
    count: allEmails.length,
    emails: allEmails,
    metadata: {
      createdAt: new Date().toISOString(),
      previousBackup: recentBackup ? recentBackup.filename : null,
      newEmailsAdded: newData.emails.length,
      totalEmails: allEmails.length,
    },
  };

  await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));

  return {
    filename,
    filepath,
    newCount: newData.emails.length,
    totalCount: allEmails.length,
    previousCount: previousCount,
  };
}

/**
 * Main backup function
 */
async function backupEmails() {
  console.log("🔄 Starting email backup...");
  console.log(`📡 Fetching from: ${API_ENDPOINT}`);

  try {
    // Fetch emails from API (this clears the server memory)
    const data = await fetchEmails();

    if (data.emails.length === 0) {
      console.log("📭 No new emails to backup");
      return {
        success: true,
        newEmails: 0,
        message: "No new emails",
      };
    }

    console.log(`📧 Retrieved ${data.emails.length} new email(s) from server`);
    console.log(`🧹 Server memory ${data.cleared ? "cleared" : "NOT cleared"}`);

    // Save to timestamped file (appending to most recent)
    const result = await saveBackup(data);

    console.log(`✅ Backup saved: ${result.filename}`);
    console.log(`   📊 New emails: ${result.newCount}`);
    console.log(`   📊 Previous total: ${result.previousCount}`);
    console.log(`   📊 Current total: ${result.totalCount}`);
    console.log(`📁 Full path: ${result.filepath}`);
    console.log("✅ Backup completed successfully!");

    return {
      success: true,
      filename: result.filename,
      newEmails: result.newCount,
      totalEmails: result.totalCount,
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
