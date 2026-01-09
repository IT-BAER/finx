/**
 * Refresh Token Utility
 * Provides secure refresh token generation, storage, and validation
 * with token family tracking for reuse attack detection.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const logger = require("./logger");

// Configuration
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a cryptographically secure refresh token
 * @returns {string} Base64-encoded refresh token
 */
function generateRefreshToken() {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/**
 * Generate a new token family ID (UUID v4)
 * @returns {string} UUID for token family
 */
function generateTokenFamily() {
    return crypto.randomUUID();
}

/**
 * Hash a refresh token for secure storage
 * @param {string} token - Raw refresh token
 * @returns {Promise<string>} Hashed token
 */
async function hashToken(token) {
    return bcrypt.hash(token, BCRYPT_ROUNDS);
}

/**
 * Compare a raw token with its hash
 * @param {string} token - Raw refresh token
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if match
 */
async function compareToken(token, hash) {
    if (!token || !hash) return false;
    return bcrypt.compare(token, hash);
}

/**
 * Calculate refresh token expiry date
 * @param {number} days - Days until expiry
 * @returns {Date} Expiry date
 */
function calculateExpiry(days = REFRESH_TOKEN_EXPIRY_DAYS) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
}

/**
 * Store a refresh token for a user
 * @param {number} userId - User ID
 * @param {string} tokenHash - Hashed refresh token
 * @param {string} tokenFamily - Token family UUID
 * @param {Date} expiresAt - Expiry timestamp
 */
async function storeRefreshToken(userId, tokenHash, tokenFamily, expiresAt) {
    const query = `
    UPDATE users
    SET refresh_token_hash = $1,
        refresh_token_family = $2,
        refresh_token_expires = $3
    WHERE id = $4
  `;
    await db.query(query, [tokenHash, tokenFamily, expiresAt, userId]);
}

/**
 * Get refresh token data for a user
 * @param {number} userId - User ID
 * @returns {Promise<{hash: string, family: string, expires: Date}|null>}
 */
async function getRefreshTokenData(userId) {
    const query = `
    SELECT refresh_token_hash, refresh_token_family, refresh_token_expires
    FROM users
    WHERE id = $1
  `;
    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        hash: row.refresh_token_hash,
        family: row.refresh_token_family,
        expires: row.refresh_token_expires,
    };
}

/**
 * Revoke all refresh tokens for a user (logout)
 * @param {number} userId - User ID
 */
async function revokeRefreshToken(userId) {
    const query = `
    UPDATE users
    SET refresh_token_hash = NULL,
        refresh_token_family = NULL,
        refresh_token_expires = NULL
    WHERE id = $1
  `;
    await db.query(query, [userId]);
}

/**
 * Revoke all tokens for a token family (security breach response)
 * This invalidates all tokens in the family across all users (shouldn't happen, but safety)
 * @param {string} tokenFamily - Token family UUID
 */
async function revokeTokenFamily(tokenFamily) {
    const query = `
    UPDATE users
    SET refresh_token_hash = NULL,
        refresh_token_family = NULL,
        refresh_token_expires = NULL
    WHERE refresh_token_family = $1
  `;
    await db.query(query, [tokenFamily]);
    logger.warn(`Token family ${tokenFamily} revoked due to potential reuse attack`);
}

/**
 * Validate and rotate a refresh token
 * Implements token rotation with reuse detection
 * @param {number} userId - User ID
 * @param {string} token - Raw refresh token
 * @param {string} tokenFamily - Expected token family
 * @returns {Promise<{valid: boolean, newToken?: string, newFamily?: string, error?: string}>}
 */
async function validateAndRotateToken(userId, token, tokenFamily) {
    logger.info(`[RefreshToken] Validating for user ${userId}, family: ${tokenFamily?.substring(0, 8)}...`);

    const tokenData = await getRefreshTokenData(userId);

    // No refresh token stored
    if (!tokenData || !tokenData.hash) {
        logger.warn(`[RefreshToken] No refresh token found in DB for user ${userId}`);
        return { valid: false, error: "No refresh token found" };
    }

    logger.info(`[RefreshToken] DB has token - stored family: ${tokenData.family?.substring(0, 8)}..., expires: ${tokenData.expires}`);

    // Token family mismatch - potential reuse attack!
    if (tokenData.family !== tokenFamily) {
        logger.error(`[RefreshToken] Family mismatch! Stored: ${tokenData.family}, Received: ${tokenFamily}`);
        // Revoke all tokens in the claimed family (attacker's token)
        await revokeTokenFamily(tokenFamily);
        // Revoke the user's current token too (compromised)
        await revokeRefreshToken(userId);
        logger.error(`Refresh token reuse detected for user ${userId}, all tokens revoked`);
        return { valid: false, error: "Token reuse detected - all sessions revoked" };
    }

    // Check expiry
    if (new Date() > new Date(tokenData.expires)) {
        logger.warn(`[RefreshToken] Token expired for user ${userId}. Expiry: ${tokenData.expires}`);
        await revokeRefreshToken(userId);
        return { valid: false, error: "Refresh token expired" };
    }

    // Validate token
    const isValid = await compareToken(token, tokenData.hash);
    if (!isValid) {
        logger.warn(`[RefreshToken] Token hash mismatch for user ${userId}`);
        return { valid: false, error: "Invalid refresh token" };
    }

    logger.info(`[RefreshToken] Token valid for user ${userId}, rotating...`);

    // Token is valid - rotate it
    const newToken = generateRefreshToken();
    const newTokenHash = await hashToken(newToken);
    const newExpiry = calculateExpiry();
    // Keep the same family for valid rotations
    await storeRefreshToken(userId, newTokenHash, tokenFamily, newExpiry);

    return {
        valid: true,
        newToken,
        newFamily: tokenFamily, // Same family for valid rotation
    };
}

/**
 * Create a new refresh token for a user (after login)
 * @param {number} userId - User ID
 * @returns {Promise<{token: string, family: string, expiresAt: Date}>}
 */
async function createRefreshToken(userId) {
    const token = generateRefreshToken();
    const tokenHash = await hashToken(token);
    const tokenFamily = generateTokenFamily();
    const expiresAt = calculateExpiry();

    await storeRefreshToken(userId, tokenHash, tokenFamily, expiresAt);

    return {
        token,
        family: tokenFamily,
        expiresAt,
    };
}

module.exports = {
    generateRefreshToken,
    generateTokenFamily,
    hashToken,
    compareToken,
    calculateExpiry,
    storeRefreshToken,
    getRefreshTokenData,
    revokeRefreshToken,
    revokeTokenFamily,
    validateAndRotateToken,
    createRefreshToken,
    REFRESH_TOKEN_EXPIRY_DAYS,
};
