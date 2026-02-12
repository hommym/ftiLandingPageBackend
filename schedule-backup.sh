#!/bin/bash
# Daily Email Backup Scheduler
# This script sets up a cron job to run email backups daily

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-emails.js"
NODE_PATH=$(which node)

# Default time: 9:00 AM daily
HOUR=${1:-9}
MINUTE=${2:-0}

echo "📅 Setting up daily email backup..."
echo "⏰ Scheduled time: ${HOUR}:${MINUTE}"
echo "📁 Script location: $BACKUP_SCRIPT"

# Create cron job entry
CRON_ENTRY="$MINUTE $HOUR * * * cd $SCRIPT_DIR && $NODE_PATH $BACKUP_SCRIPT >> $SCRIPT_DIR/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Backup job already exists in crontab"
    echo "📋 Current crontab entries for this script:"
    crontab -l | grep "$BACKUP_SCRIPT"
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled. No changes made."
        exit 0
    fi
    # Remove old entry
    crontab -l | grep -v "$BACKUP_SCRIPT" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job added successfully!"
echo ""
echo "📋 Cron job details:"
echo "   Command: $CRON_ENTRY"
echo ""
echo "📝 To view all cron jobs:"
echo "   crontab -l"
echo ""
echo "🗑️  To remove this backup job:"
echo "   crontab -e"
echo "   (then delete the line containing 'backup-emails.js')"
echo ""
echo "📊 Backup logs will be saved to:"
echo "   $SCRIPT_DIR/backup.log"
