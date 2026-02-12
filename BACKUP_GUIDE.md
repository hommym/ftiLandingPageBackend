# Email Backup System

This guide explains how to use the automated backup system for your email submissions.

## Overview

The backup system fetches emails from your deployed API and saves them to timestamped JSON files. Each backup **appends new emails to the most recent backup**, maintaining a complete cumulative history.

**Important:** The backup scheduler **clears server memory** after retrieval, preventing data loss on Render's free tier.

## Files

- [`backup-emails.js`](backup-emails.js:1) - Main backup script
- [`schedule-backup.sh`](schedule-backup.sh:1) - Automatic scheduling helper (Linux/Mac)

## Quick Start

### 1. Set Up Environment

First, configure your scheduler secret:

```bash
cp .env.example .env
```

Edit `.env` and set the same secret key as your Render server:

```
SCHEDULER_SECRET=your-secret-key-from-render
```

### 2. Run Backup Manually

```bash
node backup-emails.js
```

Output:

```
🔄 Starting email backup...
📡 Fetching from: https://ftilandingpagebackend.onrender.com/api/emails
📧 Retrieved 5 new email(s) from server
🧹 Server memory cleared
📎 Found previous backup: emails_2026-02-12_09-00-00.json (10 emails)
✅ Backup saved: emails_2026-02-12_15-00-00.json
   📊 New emails: 5
   📊 Previous total: 10
   📊 Current total: 15
� Full path: /path/to/email-backups/emails_2026-02-12_15-00-00.json
✅ Backup completed successfully!
```

### 3. View Backups

All backups are saved in the `email-backups/` directory:

```
email-backups/
├── emails_2026-02-12_09-00-00.json   (10 emails)
├── emails_2026-02-12_15-00-00.json   (15 emails - appended 5)
├── emails_2026-02-13_09-00-00.json   (20 emails - appended 5)
└── emails_2026-02-14_09-00-00.json   (25 emails - appended 5)
```

Each file contains **cumulative data** plus metadata:

```json
{
  "count": 15,
  "emails": [
    {
      "email": "user@example.com",
      "timestamp": "2026-02-12T08:30:00.000Z",
      "id": 1707730200123.456
    }
  ],
  "metadata": {
    "createdAt": "2026-02-12T15:00:00.000Z",
    "previousBackup": "emails_2026-02-12_09-00-00.json",
    "newEmailsAdded": 5,
    "totalEmails": 15
  }
}
```

## Automatic Daily Backups

### Using Cron (Linux/Mac)

Run the setup script:

```bash
./schedule-backup.sh
```

This schedules a daily backup at 9:00 AM.

**Custom time:**

```bash
./schedule-backup.sh 14 30  # Runs at 14:30 (2:30 PM)
```

**View scheduled jobs:**

```bash
crontab -l
```

**Remove scheduled backup:**

```bash
crontab -e
# Delete the line containing 'backup-emails.js'
```

### Using Windows Task Scheduler

1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Name: "Email Backup"
4. Trigger: **Daily**
5. Time: **9:00 AM**
6. Action: **Start a program**
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `C:\path\to\backup-emails.js`
   - Start in: `C:\path\to\project`
7. Click **Finish**

### Using Node-Cron (Cross-platform)

Install node-cron:

```bash
npm install node-cron
```

Create `scheduler.js`:

```javascript
const cron = require("node-cron");
const { backupEmails } = require("./backup-emails");

// Run daily at 9:00 AM
cron.schedule("0 9 * * *", () => {
  console.log("Running scheduled backup...");
  backupEmails();
});

console.log("Backup scheduler started. Press Ctrl+C to stop.");
```

Run:

```bash
node scheduler.js
```

Keep it running in the background (use PM2):

```bash
npm install -g pm2
pm2 start scheduler.js --name "email-backup-scheduler"
pm2 save
pm2 startup
```

## File Naming Format

Files are named with the exact date and time of backup:

```
emails_YYYY-MM-DD_HH-MM-SS.json
```

Examples:

- `emails_2026-02-12_09-00-00.json` - Feb 12, 2026 at 9:00 AM
- `emails_2026-02-12_15-30-45.json` - Feb 12, 2026 at 3:30:45 PM
- `emails_2026-12-31_23-59-59.json` - Dec 31, 2026 at 11:59:59 PM

## How It Works

1. **Fetch**: Makes HTTPS GET request to `https://ftilandingpagebackend.onrender.com/api/emails`
2. **Generate filename**: Creates timestamp-based filename
3. **Save**: Writes JSON data to `email-backups/` directory
4. **Log**: Outputs success/failure information

## Backup Logs

When running via cron, logs are saved to `backup.log`:

```bash
# View recent logs
tail -f backup.log

# View all logs
cat backup.log
```

## Comparing Backups

To see what changed between backups:

```bash
# Install jq for JSON diffing
sudo apt-get install jq

# Compare two backups
diff \
  <(jq -S . email-backups/emails_2026-02-12_09-00-00.json) \
  <(jq -S . email-backups/emails_2026-02-13_09-00-00.json)
```

## Configuration

Edit [`backup-emails.js`](backup-emails.js:6) to change settings:

```javascript
// Change API endpoint
const API_ENDPOINT = "https://your-api.com/api/emails";

// Change backup directory
const BACKUP_DIR = path.join(__dirname, "my-backups");
```

## Troubleshooting

### "HTTP request failed"

- Check internet connection
- Verify API endpoint is accessible: `curl https://ftilandingpagebackend.onrender.com/api/emails`

### "Failed to parse JSON"

- API might be returning an error
- Test endpoint manually in browser

### "Permission denied" (Linux/Mac)

```bash
chmod +x schedule-backup.sh
```

### Cron job not running

```bash
# Check cron service status
sudo service cron status

# View cron logs
grep CRON /var/log/syslog
```

## Best Practices

1. **Regular backups**: Run at least once daily
2. **Multiple backups**: Keep 30+ days of history
3. **Off-site storage**: Upload to cloud storage (Google Drive, Dropbox)
4. **Monitor logs**: Check backup.log regularly
5. **Test restores**: Periodically verify backups are readable

## Advanced: Upload to Cloud

Example: Upload to Google Drive using `rclone`:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure Google Drive
rclone config

# Sync backups to cloud
rclone sync email-backups/ gdrive:email-backups
```

Add to cron after backup:

```bash
0 10 * * * cd /path/to/project && rclone sync email-backups/ gdrive:email-backups
```
