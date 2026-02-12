# In-Memory Storage System

## Overview

This system is designed to solve the **Render free tier data loss problem** where files disappear after the server goes idle. Instead of persisting to files on the server, emails are stored in memory until retrieved by the backup scheduler.

## How It Works

### 1. Email Submission

When a user submits an email:

- Email is validated
- Stored **in memory only** (no file writing on server)
- User receives confirmation
- Data persists in RAM until scheduler retrieves it

```javascript
// In server.js
let emailsInMemory = [];

app.post("/api/submit-email", async (req, res) => {
  emailsInMemory.push({
    email: email,
    timestamp: new Date().toISOString(),
    id: Date.now() + Math.random(),
  });
});
```

### 2. Scheduler Retrieval

The backup scheduler authenticates with a secret key:

- Makes GET request with `?secret=YOUR_SECRET_KEY`
- Server returns all emails in memory
- **Server CLEARS memory after successful retrieval**
- Scheduler saves to local backup file

```bash
GET /api/emails?secret=your-secret-key-change-in-production
```

Response:

```json
{
  "count": 5,
  "emails": [...],
  "cleared": true  ← Memory was cleared
}
```

### 3. Backup Appending

Each backup:

- Reads the **most recent backup file**
- Appends new emails to existing data
- Saves as a **new timestamped backup**
- Maintains complete history

```
Backup 1: emails_2026-02-12_09-00-00.json → [email1, email2]
Backup 2: emails_2026-02-12_15-00-00.json → [email1, email2, email3, email4]
Backup 3: emails_2026-02-13_09-00-00.json → [email1, email2, email3, email4, email5]
```

## Data Flow Diagram

```
User Submits Email
       ↓
[Server RAM Storage]
emailsInMemory = [email1, email2, email3]
       ↓
Scheduler runs (every X hours)
       ↓
GET /api/emails?secret=KEY
       ↓
[Server Response]
Returns emails & CLEARS memory
emailsInMemory = []
       ↓
[Backup Script]
Reads: emails_2026-02-12_09-00-00.json [email1]
Appends: [email1, email2, email3]
Saves: emails_2026-02-12_15-00-00.json
       ↓
[Complete History Preserved]
```

## Why This Solves the Problem

### ❌ Without This System (File-based):

1. User submits email
2. Saved to `emails.json` on Render server
3. Server goes idle after 15 minutes
4. Server restarts (free tier behavior)
5. **File is lost** ❌

### ✅ With This System (Memory + Scheduled Backup):

1. User submits email
2. Stored in RAM (temporary)
3. Scheduler retrieves every few hours
4. Data backed up locally **before server can lose it**
5. Server memory cleared (ready for next batch)
6. **No data loss** ✅

## Configuration

### Server Setup (Render)

Set environment variable in Render dashboard:

```
SCHEDULER_SECRET=generate-a-strong-random-key-here
```

Generate a secure key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Local Setup

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set the same secret:

```
SCHEDULER_SECRET=same-key-as-render-server
```

## Scheduler Frequency

**Critical**: Run scheduler more frequently than server idle timeout!

Render free tier idles after **15 minutes** of inactivity.

**Recommended frequencies:**

- **Every 5 minutes** (safest, no data loss risk)
- **Every 10 minutes** (safe)
- **Every hour** (acceptable for low-traffic sites)
- **Every 6 hours** (risky if server idles)

### Setting Up 5-Minute Backups

**Using cron:**

```bash
*/5 * * * * cd /path/to/project && node backup-emails.js >> backup.log 2>&1
```

**Using node-cron:**

```javascript
// scheduler.js
const cron = require("node-cron");
const { backupEmails } = require("./backup-emails");

// Run every 5 minutes
cron.schedule("*/5 * * * *", () => {
  console.log("Running 5-minute backup...");
  backupEmails();
});
```

## Authentication Details

### Scheduler Authentication

```javascript
// Server checks for secret in query parameter
const { secret } = req.query;
const isScheduler = secret === SCHEDULER_SECRET;
```

### Regular User Access

Users can still view current emails without the secret:

```bash
GET /api/emails
```

Response:

```json
{
  "count": 3,
  "emails": [...],
  "cleared": false  ← Memory NOT cleared
}
```

## Backup File Structure

Each backup contains metadata:

```json
{
  "count": 10,
  "emails": [
    {
      "email": "user@example.com",
      "timestamp": "2026-02-12T09:00:00.000Z",
      "id": 1707730200123.456
    }
  ],
  "metadata": {
    "createdAt": "2026-02-12T15:00:00.000Z",
    "previousBackup": "emails_2026-02-12_09-00-00.json",
    "newEmailsAdded": 5,
    "totalEmails": 10
  }
}
```

## Memory Considerations

### Server Memory (Render Free Tier)

- **RAM limit**: 512 MB
- **Email size**: ~200 bytes per email
- **Capacity**: ~2.5 million emails (theoretical)
- **Realistic**: 10,000+ emails safe

### When to Clear Memory

Memory is cleared **only** when scheduler retrieves with secret key. This prevents:

- Accidental clearing by regular users
- Data loss from unauthorized access
- Race conditions during backup

## Monitoring

### Check Server Memory Status

```bash
curl https://ftilandingpagebackend.onrender.com/health
```

Response:

```json
{
  "status": "OK",
  "emailsInMemory": 47
}
```

### View Backup Logs

```bash
tail -f backup.log
```

Example log:

```
🔄 Starting email backup...
📧 Retrieved 5 new email(s) from server
🧹 Server memory cleared
📎 Found previous backup: emails_2026-02-12_09-00-00.json (10 emails)
✅ Backup saved: emails_2026-02-12_15-00-00.json
   📊 New emails: 5
   📊 Previous total: 10
   📊 Current total: 15
```

## Edge Cases

### What if scheduler fails?

- Emails remain in server memory
- Next successful run retrieves all accumulated emails
- No data loss unless server restarts before next backup

### What if server restarts?

- In-memory data is LOST (RAM cleared on restart)
- **Solution**: Run scheduler frequently (every 5-10 minutes)
- Free tier idles after 15 min, so backup well before that

### What if backup script crashes?

- Server memory is NOT cleared (secret request never completed)
- Emails safe until next backup attempt
- Check backup.log for errors

### What if two schedulers run simultaneously?

- First one clears memory
- Second one finds empty memory
- Creates backup with 0 new emails (harmless)

## Best Practices

1. **Backup frequency** < Server idle timeout (5-10 min for Render free tier)
2. **Monitor** `backup.log` for failures
3. **Test** scheduler before going live
4. **Secure** the SCHEDULER_SECRET (use strong random key)
5. **Verify** backups regularly
6. **Upload** backups to cloud storage (Google Drive, Dropbox)

## Testing

### Test Memory Storage

```bash
# Submit test email
curl -X POST https://ftilandingpagebackend.onrender.com/api/submit-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check memory
curl https://ftilandingpagebackend.onrender.com/health
# Should show: "emailsInMemory": 1
```

### Test Scheduler Retrieval

```bash
# Run backup manually
node backup-emails.js

# Check server memory again
curl https://ftilandingpagebackend.onrender.com/health
# Should show: "emailsInMemory": 0 (cleared)
```

### Test Backup Appending

```bash
# Run backup multiple times
node backup-emails.js
# Wait, submit more emails
node backup-emails.js

# Check backups directory
ls -lah email-backups/
# Should see multiple files with increasing totals
```

## Migration from Old System

If you have existing `emails.json` file:

```javascript
// One-time migration script
const fs = require("fs");
const old = JSON.parse(fs.readFileSync("emails.json"));
const backup = {
  count: old.length,
  emails: old,
  metadata: {
    createdAt: new Date().toISOString(),
    previousBackup: null,
    newEmailsAdded: old.length,
    totalEmails: old.length,
  },
};
fs.writeFileSync(
  `email-backups/emails_migration_${Date.now()}.json`,
  JSON.stringify(backup, null, 2),
);
```
