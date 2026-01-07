/**
 * Validation Middleware for FinX
 * 
 * Express middleware for validating request body, query, and params
 * using Zod schemas.
 */

const { ZodError } = require('zod');

/**
 * Format Zod errors into a user-friendly format
 */
const formatZodErrors = (error) => {
  if (!(error instanceof ZodError)) {
    return { message: 'Validation error', errors: [] };
  }
  
  // Defensive check for error.errors being undefined or not an array
  const zodErrors = error.errors || error.issues || [];
  if (!Array.isArray(zodErrors)) {
    return { 
      message: error.message || 'Validation failed', 
      errors: [] 
    };
  }
  
  const errors = zodErrors.map(err => ({
    field: err.path?.join('.') || '',
    message: err.message || 'Invalid value',
    code: err.code || 'validation_error',
  }));
  
  // Create a summary message from the first few errors
  const summary = errors.slice(0, 3).map(e => 
    e.field ? `${e.field}: ${e.message}` : e.message
  ).join('; ');
  
  return {
    message: summary || 'Validation failed',
    errors,
  };
};

/**
 * Create validation middleware for request body
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, errors } = formatZodErrors(error);
        return res.status(400).json({
          success: false,
          message,
          errors,
        });
      }
      next(error);
    }
  };
};

/**
 * Create validation middleware for query parameters
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, errors } = formatZodErrors(error);
        return res.status(400).json({
          success: false,
          message,
          errors,
        });
      }
      next(error);
    }
  };
};

/**
 * Create validation middleware for route parameters
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, errors } = formatZodErrors(error);
        return res.status(400).json({
          success: false,
          message,
          errors,
        });
      }
      next(error);
    }
  };
};

/**
 * Combined validation middleware
 * @param {Object} schemas - Object containing body, query, and/or params schemas
 * @returns {Function} Express middleware
 */
const validate = ({ body, query, params }) => {
  return async (req, res, next) => {
    const errors = [];
    
    try {
      if (body) {
        req.body = await body.parseAsync(req.body);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...error.errors.map(e => ({
          location: 'body',
          field: e.path.join('.'),
          message: e.message,
        })));
      }
    }
    
    try {
      if (query) {
        req.query = await query.parseAsync(req.query);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...error.errors.map(e => ({
          location: 'query',
          field: e.path.join('.'),
          message: e.message,
        })));
      }
    }
    
    try {
      if (params) {
        req.params = await params.parseAsync(req.params);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...error.errors.map(e => ({
          location: 'params',
          field: e.path.join('.'),
          message: e.message,
        })));
      }
    }
    
    if (errors.length > 0) {
      const summary = errors.slice(0, 3).map(e => 
        `${e.location}.${e.field}: ${e.message}`
      ).join('; ');
      
      return res.status(400).json({
        success: false,
        message: summary || 'Validation failed',
        errors,
      });
    }
    
    next();
  };
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validate,
  formatZodErrors,
};
