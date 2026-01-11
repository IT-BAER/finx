/**
 * Refresh Token Utility
 * Provides secure refresh token generation, storage, and validation
 * with token family tracking for reuse attack detection.
 * 
 * Updated for multi-device support - tokens are stored in refresh_tokens table
 * instead of users table, allowing multiple concurrent sessions per user.
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const logger = require("./logger");

// Configuration
const REFRESH_TOKEN_EXPIRY_DAYS = 90; // 90 days for persistent login (sliding window - each refresh extends)
const REFRESH_TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;
const MAX_SESSIONS_PER_USER = 10; // Maximum concurrent sessions per user

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
 * Store a refresh token for a user (multi-device version)
 * @param {number} userId - User ID
 * @param {string} tokenHash - Hashed refresh token
 * @param {string} tokenFamily - Token family UUID
 * @param {Date} expiresAt - Expiry timestamp
 * @param {Object} deviceInfo - Device information
 */
async function storeRefreshToken(userId, tokenHash, tokenFamily, expiresAt, deviceInfo = {}) {
    const { deviceId = 'unknown', deviceName = 'Unknown Device', deviceType = 'unknown', ipAddress = null, userAgent = null } = deviceInfo;
    
    const query = `
        INSERT INTO refresh_tokens (user_id, token_hash, token_family, device_id, device_name, device_type, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (token_family) DO UPDATE SET
            token_hash = EXCLUDED.token_hash,
            expires_at = EXCLUDED.expires_at,
            last_used_at = CURRENT_TIMESTAMP
        RETURNING id, token_family
    `;
    try {
        const result = await db.query(query, [userId, tokenHash, tokenFamily, deviceId, deviceName, deviceType, expiresAt, ipAddress, userAgent]);
        if (result.rowCount === 0) {
            logger.error(`[RefreshToken] Failed to store token for user ${userId}`);
        } else {
            logger.info(`[RefreshToken] Stored token for user ${userId}, family: ${tokenFamily?.substring(0, 8)}..., device: ${deviceId}, expires: ${expiresAt.toISOString()}`);
        }
    } catch (err) {
        logger.error(`[RefreshToken] Error storing token for user ${userId}:`, err.message);
        throw err;
    }
}

/**
 * Get refresh token data by token family (multi-device version)
 * @param {number} userId - User ID
 * @param {string} tokenFamily - Token family UUID
 * @returns {Promise<{hash: string, family: string, expires: Date, deviceId: string}|null>}
 */
async function getRefreshTokenData(userId, tokenFamily) {
    const query = `
        SELECT id, token_hash, token_family, device_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE user_id = $1 AND token_family = $2
    `;
    try {
        const result = await db.query(query, [userId, tokenFamily]);
        if (result.rows.length === 0) {
            // Fall back to legacy users table for migration compatibility
            const legacyResult = await db.query(
                `SELECT refresh_token_hash, refresh_token_family, refresh_token_expires FROM users WHERE id = $1`,
                [userId]
            );
            if (legacyResult.rows.length > 0 && legacyResult.rows[0].refresh_token_family === tokenFamily) {
                logger.info(`[RefreshToken] Found legacy token for user ${userId} in users table`);
                const row = legacyResult.rows[0];
                if (!row.refresh_token_hash) {
                    logger.warn(`[RefreshToken] Legacy token for user ${userId} has NULL hash`);
                    return null;
                }
                return {
                    hash: row.refresh_token_hash,
                    family: row.refresh_token_family,
                    expires: row.refresh_token_expires,
                    deviceId: 'legacy',
                    isLegacy: true,
                };
            }
            logger.warn(`[RefreshToken] No token found for user ${userId}, family: ${tokenFamily?.substring(0, 8)}...`);
            return null;
        }

        const row = result.rows[0];
        
        // Check if token was revoked
        if (row.revoked_at) {
            logger.warn(`[RefreshToken] Token for user ${userId} was revoked at ${row.revoked_at}`);
            return null;
        }
        
        return {
            id: row.id,
            hash: row.token_hash,
            family: row.token_family,
            expires: row.expires_at,
            deviceId: row.device_id,
        };
    } catch (err) {
        logger.error(`[RefreshToken] Error getting token data for user ${userId}:`, err.message);
        throw err;
    }
}

/**
 * Revoke a specific refresh token by token family (single device logout)
 * @param {number} userId - User ID
 * @param {string} tokenFamily - Token family UUID (optional - if not provided, revokes all)
 */
async function revokeRefreshToken(userId, tokenFamily = null) {
    if (tokenFamily) {
        logger.info(`[RefreshToken] Revoking token for user ${userId}, family: ${tokenFamily.substring(0, 8)}...`);
        const query = `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND token_family = $2 AND revoked_at IS NULL
        `;
        await db.query(query, [userId, tokenFamily]);
        logger.info(`[RefreshToken] Token revoked for user ${userId}, family: ${tokenFamily.substring(0, 8)}...`);
    } else {
        logger.info(`[RefreshToken] Revoking ALL tokens for user ${userId}`);
        // Revoke all tokens for this user (logout all devices)
        const query = `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND revoked_at IS NULL
        `;
        await db.query(query, [userId]);
        
        // Also clear legacy tokens in users table
        await db.query(
            `UPDATE users SET refresh_token_hash = NULL, refresh_token_family = NULL, refresh_token_expires = NULL WHERE id = $1`,
            [userId]
        );
        logger.info(`[RefreshToken] All tokens revoked for user ${userId}`);
    }
}

/**
 * Revoke all tokens for a token family (security breach response)
 * @param {string} tokenFamily - Token family UUID
 */
async function revokeTokenFamily(tokenFamily) {
    // Revoke in new table
    const query = `
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_family = $1 AND revoked_at IS NULL
    `;
    await db.query(query, [tokenFamily]);
    
    // Also clear legacy tokens in users table
    await db.query(
        `UPDATE users SET refresh_token_hash = NULL, refresh_token_family = NULL, refresh_token_expires = NULL WHERE refresh_token_family = $1`,
        [tokenFamily]
    );
    logger.warn(`[RefreshToken] Token family ${tokenFamily.substring(0, 8)}... revoked due to potential reuse attack`);
}

/**
 * Validate and rotate a refresh token (multi-device version)
 * Implements token rotation with reuse detection
 * @param {number} userId - User ID
 * @param {string} token - Raw refresh token
 * @param {string} tokenFamily - Expected token family
 * @param {Object} deviceInfo - Device information for tracking
 * @returns {Promise<{valid: boolean, newToken?: string, newFamily?: string, error?: string}>}
 */
async function validateAndRotateToken(userId, token, tokenFamily, deviceInfo = {}) {
    logger.info(`[RefreshToken] Validating for user ${userId}, family: ${tokenFamily?.substring(0, 8)}...`);

    const tokenData = await getRefreshTokenData(userId, tokenFamily);

    // No refresh token stored
    if (!tokenData || !tokenData.hash) {
        logger.warn(`[RefreshToken] No refresh token found in DB for user ${userId}, family: ${tokenFamily?.substring(0, 8)}...`);
        return { valid: false, error: "No refresh token found" };
    }

    logger.info(`[RefreshToken] DB has token - stored family: ${tokenData.family?.substring(0, 8)}..., expires: ${tokenData.expires}, device: ${tokenData.deviceId}`);

    // Check expiry
    if (new Date() > new Date(tokenData.expires)) {
        logger.warn(`[RefreshToken] Token expired for user ${userId}. Expiry: ${tokenData.expires}`);
        await revokeRefreshToken(userId, tokenFamily);
        return { valid: false, error: "Refresh token expired" };
    }

    // Validate token
    const isValid = await compareToken(token, tokenData.hash);
    if (!isValid) {
        logger.warn(`[RefreshToken] Token hash mismatch for user ${userId} - potential token reuse!`);
        // This could be a token reuse attack - revoke the entire family
        await revokeTokenFamily(tokenFamily);
        return { valid: false, error: "Invalid refresh token - session revoked for security" };
    }

    logger.info(`[RefreshToken] Token valid for user ${userId}, rotating...`);

    // Token is valid - rotate it
    const newToken = generateRefreshToken();
    const newTokenHash = await hashToken(newToken);
    const newExpiry = calculateExpiry();
    
    // Preserve device info from original token, merge with any new info
    const mergedDeviceInfo = {
        deviceId: deviceInfo.deviceId || tokenData.deviceId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
    };
    
    // Keep the same family for valid rotations
    await storeRefreshToken(userId, newTokenHash, tokenFamily, newExpiry, mergedDeviceInfo);

    // If this was a legacy token, clear it from users table after successful migration
    if (tokenData.isLegacy) {
        logger.info(`[RefreshToken] Migrating legacy token for user ${userId} to new table`);
        await db.query(
            `UPDATE users SET refresh_token_hash = NULL, refresh_token_family = NULL, refresh_token_expires = NULL WHERE id = $1`,
            [userId]
        );
    }

    return {
        valid: true,
        newToken,
        newFamily: tokenFamily, // Same family for valid rotation
    };
}

/**
 * Create a new refresh token for a user (after login) - multi-device version
 * @param {number} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<{token: string, family: string, expiresAt: Date}>}
 */
async function createRefreshToken(userId, deviceInfo = {}) {
    const { deviceId = 'unknown-' + Date.now(), deviceName = 'Unknown Device', deviceType = 'unknown' } = deviceInfo;
    
    logger.info(`[RefreshToken] Creating new refresh token for user ${userId}, device: ${deviceId}`);
    
    // Clean up old sessions if user has too many
    await cleanupOldSessions(userId);
    
    // Check if this device already has a valid token
    if (deviceId && deviceId !== 'unknown-' + Date.now()) {
        const existingQuery = `
            SELECT token_family FROM refresh_tokens 
            WHERE user_id = $1 AND device_id = $2 AND revoked_at IS NULL
        `;
        const existing = await db.query(existingQuery, [userId, deviceId]);
        if (existing.rows.length > 0) {
            // Revoke the old token for this device before creating new one
            logger.info(`[RefreshToken] Revoking old token for device ${deviceId} before creating new one`);
            await revokeRefreshToken(userId, existing.rows[0].token_family);
        }
    }
    
    const token = generateRefreshToken();
    const tokenHash = await hashToken(token);
    const tokenFamily = generateTokenFamily();
    const expiresAt = calculateExpiry();

    await storeRefreshToken(userId, tokenHash, tokenFamily, expiresAt, deviceInfo);
    
    // Verify it was stored correctly
    const stored = await getRefreshTokenData(userId, tokenFamily);
    if (!stored || !stored.hash) {
        logger.error(`[RefreshToken] CRITICAL: Token was not stored for user ${userId}!`);
    } else {
        logger.info(`[RefreshToken] Token created and verified for user ${userId}, family: ${tokenFamily.substring(0, 8)}..., device: ${deviceId}`);
    }

    return {
        token,
        family: tokenFamily,
        expiresAt,
    };
}

/**
 * Clean up old sessions for a user (keep only MAX_SESSIONS_PER_USER most recent)
 * @param {number} userId - User ID
 */
async function cleanupOldSessions(userId) {
    const countQuery = `SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`;
    const countResult = await db.query(countQuery, [userId]);
    const sessionCount = parseInt(countResult.rows[0].count, 10);
    
    if (sessionCount >= MAX_SESSIONS_PER_USER) {
        logger.info(`[RefreshToken] User ${userId} has ${sessionCount} sessions, cleaning up oldest...`);
        // Revoke oldest sessions to make room
        const revokeQuery = `
            UPDATE refresh_tokens
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id IN (
                SELECT id FROM refresh_tokens
                WHERE user_id = $1 AND revoked_at IS NULL
                ORDER BY last_used_at ASC
                LIMIT $2
            )
        `;
        const toRevoke = sessionCount - MAX_SESSIONS_PER_USER + 1;
        await db.query(revokeQuery, [userId, toRevoke]);
        logger.info(`[RefreshToken] Revoked ${toRevoke} old sessions for user ${userId}`);
    }
}

/**
 * Get all active sessions for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array<{id: number, deviceId: string, deviceName: string, deviceType: string, createdAt: Date, lastUsedAt: Date}>>}
 */
async function getActiveSessions(userId) {
    const query = `
        SELECT id, device_id, device_name, device_type, created_at, last_used_at, ip_address
        FROM refresh_tokens
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_used_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows.map(row => ({
        id: row.id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        deviceType: row.device_type,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        ipAddress: row.ip_address,
    }));
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
    cleanupOldSessions,
    getActiveSessions,
    REFRESH_TOKEN_EXPIRY_DAYS,
    MAX_SESSIONS_PER_USER,
};
