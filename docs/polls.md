# Polls Feature

This document describes the polls feature in the Devoter API.

## Overview

The polls feature allows users to create, manage, and participate in polls.

## API Endpoints

- `GET /polls` - Retrieve a list of polls
- `POST /polls` - Create a new poll
- `GET /polls/:id` - Retrieve a specific poll
- `PUT /polls/:id` - Update a poll
- `DELETE /polls/:id` - Delete a poll

## Usage

### Creating a Poll

To create a new poll, send a `POST` request to `/polls` with the following JSON payload. This endpoint requires a wallet signature for authentication.

**Request Body Example:**
```json
{
  "title": "Favorite Color Poll",
  "description": "A poll to decide the best color.",
  "options": ["Red", "Blue", "Green"],
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f444",
  "message": "I am creating a new poll on Devoter.",
  "signature": "0x1b4ffc81a59ec761cb4f75e3c73bcc57c92d..."
}
```

**Successful Response (201 Created):**
```json
{
  "success": true,
  "pollId": "clsdjhk000000j298s0j3x98d",
  "message": "Poll created successfully"
}
```

### Voting on a Poll

To vote on a poll, send a POST request to `/polls/:id/vote` with the selected option.

## Error Handling

Refer to the [Error Handling](error-handling.md) documentation for common error responses.

## Rate Limiting

This feature is subject to rate limiting as described in the [Rate Limiting](rate-limiting.md) documentation.
