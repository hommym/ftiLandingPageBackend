const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "emails.json");

// Middleware to parse JSON
app.use(express.json());

// Simple file-based queue to handle concurrent writes
let writeQueue = Promise.resolve();

/**
 * Thread-safe write to JSON file
 * This prevents race conditions when multiple requests write simultaneously
 */
async function saveEmailSafely(email) {
  // Chain the write operations to prevent concurrent access
  writeQueue = writeQueue.then(async () => {
    try {
      let emails = [];

      // Try to read existing file
      try {
        const data = await fs.readFile(DATA_FILE, "utf8");
        emails = JSON.parse(data);
      } catch (error) {
        // File doesn't exist or is empty, start with empty array
        if (error.code !== "ENOENT") {
          console.error("Error reading file:", error);
        }
      }

      // Add new email with timestamp
      emails.push({
        email: email,
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random(), // Simple unique ID
      });

      // Write back to file
      await fs.writeFile(DATA_FILE, JSON.stringify(emails, null, 2));

      return { success: true };
    } catch (error) {
      console.error("Error saving email:", error);
      throw error;
    }
  });

  return writeQueue;
}

// POST endpoint to submit email
app.post("/api/submit-email", async (req, res) => {
  try {
    const { email } = req.body;

    // Basic validation
    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Save email safely (handles concurrent writes)
    await saveEmailSafely(email);

    res.status(201).json({
      message: "Email submitted successfully",
      email: email,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      error: "Failed to save email. Please try again.",
    });
  }
});

// GET endpoint to view all emails (for testing purposes)
app.get("/api/emails", async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    const emails = JSON.parse(data);
    res.json({
      count: emails.length,
      emails: emails,
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      res.json({
        count: 0,
        emails: [],
      });
    } else {
      res.status(500).json({
        error: "Failed to retrieve emails",
      });
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Submit email: POST http://localhost:${PORT}/api/submit-email`);
  console.log(`View emails: GET http://localhost:${PORT}/api/emails`);
});
