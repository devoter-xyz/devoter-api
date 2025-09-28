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

To create a poll, send a POST request to `/polls` with the following JSON payload:

```json
{
  "title": "Sample Poll",
  "options": ["Option 1", "Option 2", "Option 3"],
  "expiresAt": "2023-12-31T23:59:59Z"
}
```

### Voting on a Poll

To vote on a poll, send a POST request to `/polls/:id/vote` with the selected option.

## Error Handling

Refer to the [Error Handling](error-handling.md) documentation for common error responses.

## Rate Limiting

This feature is subject to rate limiting as described in the [Rate Limiting](rate-limiting.md) documentation.
