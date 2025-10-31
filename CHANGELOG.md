# Changelog

## Unreleased

### ⚠️ Breaking Changes

*   **API Key Delimiter**: The delimiter for API keys has been changed from `_` (underscore) to `.` (dot) for improved consistency and future compatibility.
    *   **Migration Required**: Existing API keys using the `_` delimiter will continue to work during a grace period due to backward compatibility measures implemented in the API. However, it is strongly recommended to re-issue or rotate all legacy underscore-delimited API keys to the new dot-delimited format. An admin tool or script will be provided to facilitate this migration.
    *   **Client SDKs**: Client SDKs and any custom integrations that generate or validate API keys should be updated to expect and generate the new `.` delimited format.
    *   **Strict Mode**: A configuration option will be available to enforce strict `.`-only validation after the migration grace period.

### ✨ Features

*   **API Key Backward Compatibility**: Implemented backward compatibility for API key validation, allowing existing underscore-delimited keys to be normalized to dot-delimited keys during authentication.
*   **API Key Strict Validation Flag**: Added an optional `strictDotDelimiter` flag to `isValidApiKeyFormat` to enable strict dot-only validation after migration.

### 🐛 Bug Fixes

*   **Error Message Leakage**: Prevented raw internal error messages from being exposed to clients in API responses. Generic error messages are now returned for unhandled internal errors, enhancing security and preventing sensitive information leakage. Original error details are logged server-side for debugging.

### 📝 Documentation

*   Updated documentation (including this changelog) with details on the API key delimiter change, migration steps, and impact on client integrations.
