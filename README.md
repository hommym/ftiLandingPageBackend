# Email Submission API

A simple Node.js Express server with an endpoint for submitting emails. Data is stored in a JSON file with concurrency handling to prevent race conditions.

## Features

- ✅ Single POST endpoint for email submission
- ✅ Email validation
- ✅ JSON file storage
- ✅ **Concurrency handling** - Prevents data loss when multiple requests arrive simultaneously
- ✅ GET endpoint to view all submitted emails

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Submit Email

**POST** `/api/submit-email`

Request body:

```json
{
  "email": "user@example.com"
}
```

Success response (201):

```json
{
  "message": "Email submitted successfully",
  "email": "user@example.com"
}
```

Error response (400):

```json
{
  "error": "Invalid email format"
}
```

### View All Emails

**GET** `/api/emails`

Response:

```json
{
  "count": 2,
  "emails": [
    {
      "email": "user1@example.com",
      "timestamp": "2026-02-12T08:30:00.000Z",
      "id": 1707730200123.456
    },
    {
      "email": "user2@example.com",
      "timestamp": "2026-02-12T08:31:00.000Z",
      "id": 1707730260789.012
    }
  ]
}
```

### Health Check

**GET** `/health`

Response:

```json
{
  "status": "OK"
}
```

## Testing with cURL

Submit an email:

```bash
curl -X POST http://localhost:3000/api/submit-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

View all emails:

```bash
curl http://localhost:3000/api/emails
```

## Data Storage Architecture

### In-Memory Storage (Render Free Tier Solution)

**Problem:** Render free tier loses files when server idles/restarts.

**Solution:** Emails are stored **in memory** until retrieved by the backup scheduler.

```javascript
// Server stores emails in RAM (not files)
let emailsInMemory = [];
```

**How it works:**

1. User submits email → Stored in RAM
2. Scheduler runs every X minutes → Retrieves all emails
3. Server clears memory after successful retrieval
4. Scheduler appends to most recent backup file

See [`MEMORY_SYSTEM.md`](MEMORY_SYSTEM.md) for complete details.

### Scheduler Authentication

Only the backup scheduler can clear server memory:

```bash
# Regular access (view only, doesn't clear)
GET /api/emails

# Scheduler access (retrieves AND clears memory)
GET /api/emails?secret=YOUR_SECRET_KEY
```

**Important:** Set `SCHEDULER_SECRET` environment variable in Render dashboard!

## Production Considerations

For high-traffic production environments, consider:

- Using a proper database (PostgreSQL, MongoDB, etc.)
- Implementing rate limiting
- Adding CORS configuration
- Using a production-ready file locking library (like `proper-lockfile`)
- Adding logging and monitoring
- Implementing data backup strategies
