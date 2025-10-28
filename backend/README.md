# ChatCut Backend

A simple Python FastAPI backend for the ChatCut UXP extension.

## Setup

### 1. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the server

```bash
python main.py
```

The server will start at `http://localhost:3001`

## Important: UXP Network Restrictions

⚠️ **UXP plugins can only access network APIs via domain names, not IP addresses.** 

- ✅ Use: `http://localhost:3001`
- ❌ Don't use: `http://127.0.0.1:3001`

If connecting to a remote server, use a domain name (e.g., from your IT department).

## Endpoints

### `POST /api/ping`
Simple ping endpoint to test connection between frontend and backend.

**Request:**
```json
{
  "message": "user's prompt text"
}
```

**Response:**
```json
{
  "status": "ok",
  "received": "user's prompt text"
}
```

### `GET /health`
Health check endpoint to verify the server is running.

**Response:**
```json
{
  "status": "healthy"
}
```

## Development

The backend will print received messages to the console:
```
[Ping] Received message: hello world
```

To add more endpoints, add them to `main.py` following the FastAPI pattern.

