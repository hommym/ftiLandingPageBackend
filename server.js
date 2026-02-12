const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for emails (persists until retrieved by scheduler)
let emailsInMemory = [];

// Secret key for scheduler authentication
const SCHEDULER_SECRET =
  process.env.SCHEDULER_SECRET || "your-secret-key-change-in-production";

// Middleware to parse JSON
app.use(express.json());

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

    // Save email to in-memory storage
    const emailEntry = {
      email: email,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random(), // Simple unique ID
    };

    emailsInMemory.push(emailEntry);

    console.log(
      `📧 Email stored in memory: ${email} (Total: ${emailsInMemory.length})`,
    );

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

// GET endpoint for scheduler to retrieve and clear emails
app.get("/api/emails", async (req, res) => {
  try {
    const { secret } = req.query;

    // Check if request is from scheduler (has secret key)
    const isScheduler = secret === SCHEDULER_SECRET;

    if (isScheduler) {
      // Scheduler request: return data and clear memory
      const emailsToReturn = [...emailsInMemory]; // Copy current data
      const count = emailsToReturn.length;

      emailsInMemory = []; // Clear memory

      console.log(`🔄 Scheduler retrieved ${count} email(s) - Memory cleared`);

      res.json({
        count: count,
        emails: emailsToReturn,
        cleared: true,
      });
    } else {
      // Regular request: return data without clearing
      res.json({
        count: emailsInMemory.length,
        emails: emailsInMemory,
        cleared: false,
      });
    }
  } catch (error) {
    console.error("Error retrieving emails:", error);
    res.status(500).json({
      error: "Failed to retrieve emails",
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    emailsInMemory: emailsInMemory.length,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Submit email: POST http://localhost:${PORT}/api/submit-email`);
  console.log(`View emails: GET http://localhost:${PORT}/api/emails`);
  console.log(`Scheduler secret: ${SCHEDULER_SECRET}`);
});
