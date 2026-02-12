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

## Concurrency Handling

**Question: Will bugs happen if two people submit emails at the same time?**

**Answer:** Without proper handling, **YES** - you could lose data due to race conditions. Here's why:

### The Problem:

```
Time 1: User A reads file → [email1, email2]
Time 2: User B reads file → [email1, email2]
Time 3: User A writes → [email1, email2, emailA]
Time 4: User B writes → [email1, email2, emailB]  ❌ emailA is lost!
```

### The Solution:

This project implements a **write queue** using Promise chaining:

```javascript
let writeQueue = Promise.resolve();

writeQueue = writeQueue.then(async () => {
  // Read, modify, write operations happen here
  // All operations are serialized
});
```

This ensures all write operations are executed **sequentially**, one at a time, preventing data loss:

```
Time 1: User A queues write
Time 2: User B queues write (waits for A)
Time 3: User A completes → [email1, email2, emailA]
Time 4: User B executes → [email1, email2, emailA, emailB] ✅ Both saved!
```

## Data Storage

Emails are stored in `emails.json` in the project root directory:

```json
[
  {
    "email": "user@example.com",
    "timestamp": "2026-02-12T08:30:00.000Z",
    "id": 1707730200123.456
  }
]
```

## Production Considerations

For high-traffic production environments, consider:

- Using a proper database (PostgreSQL, MongoDB, etc.)
- Implementing rate limiting
- Adding CORS configuration
- Using a production-ready file locking library (like `proper-lockfile`)
- Adding logging and monitoring
- Implementing data backup strategies
