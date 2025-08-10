import { getConnectionStatus } from './client';

export enum GunErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  DATA_ERROR = 'DATA_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR'
}

export class GunError extends Error {
  type: GunErrorType;
  details?: any;
  retryable: boolean;

  constructor(type: GunErrorType, message: string, details?: any, retryable: boolean = false) {
    super(message);
    this.name = 'GunError';
    this.type = type;
    this.details = details;
    this.retryable = retryable;
  }
}

// Error tracking
interface ErrorLog {
  timestamp: string;
  error: GunError;
  context: string;
  resolved: boolean;
}

let errorHistory: ErrorLog[] = [];
const MAX_ERROR_HISTORY = 100;

/**
 * Log an error for tracking and debugging
 */
export const logGunError = (error: GunError, context: string) => {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    error,
    context,
    resolved: false
  };

  errorHistory.unshift(errorLog);
  
  // Keep only the most recent errors
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory = errorHistory.slice(0, MAX_ERROR_HISTORY);
  }

  console.error(`[Gun.js Error - ${context}]:`, error);
  
  // Report critical errors to error tracking service if available
  if (shouldReportError(error)) {
    reportError(error, context);
  }
};

/**
 * Handle Gun.js specific errors and provide user-friendly messages
 */
export const handleGunError = (error: any, operation: string): GunError => {
  let gunError: GunError;

  // Analyze the error and create appropriate GunError
  if (error?.message?.includes('not found') || error?.message?.includes('undefined')) {
    gunError = new GunError(
      GunErrorType.DATA_ERROR,
      `Data not found during ${operation}`,
      error,
      true
    );
  } else if (error?.message?.includes('timeout')) {
    gunError = new GunError(
      GunErrorType.TIMEOUT_ERROR,
      `Operation timed out: ${operation}`,
      error,
      true
    );
  } else if (error?.message?.includes('auth') || error?.message?.includes('permission')) {
    gunError = new GunError(
      GunErrorType.AUTHENTICATION_ERROR,
      `Authentication failed during ${operation}`,
      error,
      false
    );
  } else if (error?.message?.includes('encrypt') || error?.message?.includes('decrypt')) {
    gunError = new GunError(
      GunErrorType.ENCRYPTION_ERROR,
      `Encryption error during ${operation}`,
      error,
      false
    );
  } else if (error?.message?.includes('network') || error?.message?.includes('connection')) {
    gunError = new GunError(
      GunErrorType.CONNECTION_ERROR,
      `Network error during ${operation}`,
      error,
      true
    );
  } else {
    // Generic error
    gunError = new GunError(
      GunErrorType.DATA_ERROR,
      `Operation failed: ${operation} - ${error?.message || 'Unknown error'}`,
      error,
      true
    );
  }

  logGunError(gunError, operation);
  return gunError;
};

/**
 * Retry operation with exponential backoff
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'unknown'
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Mark any previous errors for this context as resolved
      errorHistory.forEach(log => {
        if (log.context === context && !log.resolved) {
          log.resolved = true;
        }
      });
      
      return result;
    } catch (error) {
      lastError = error;
      
      const gunError = handleGunError(error, `${context} (attempt ${attempt}/${maxRetries})`);
      
      // Don't retry if error is not retryable
      if (!gunError.retryable) {
        throw gunError;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying ${context} in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw handleGunError(lastError, `${context} (all retries failed)`);
};

/**
 * Handle network-related operations with proper error handling
 */
export const withConnectionCheck = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> => {
  const connectionStatus = getConnectionStatus();
  
  if (!connectionStatus.isConnected && connectionStatus.connectedPeers === 0) {
    throw new GunError(
      GunErrorType.CONNECTION_ERROR,
      'No Gun.js connection available',
      { connectionStatus },
      true
    );
  }
  
  return retryOperation(operation, 2, 1000, context);
};

/**
 * Graceful degradation handler
 */
export const withGracefulDegradation = async <T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation?: () => Promise<T>,
  context: string = 'operation'
): Promise<T | null> => {
  try {
    return await primaryOperation();
  } catch (error) {
    const gunError = handleGunError(error, `${context} (primary)`);
    
    if (fallbackOperation && gunError.retryable) {
      console.log(`Primary operation failed, trying fallback for: ${context}`);
      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        handleGunError(fallbackError, `${context} (fallback)`);
      }
    }
    
    // Return null for graceful degradation instead of throwing
    console.warn(`Operation failed with graceful degradation: ${context}`);
    return null;
  }
};

/**
 * Get error statistics for debugging
 */
export const getErrorStats = () => {
  const stats = {
    totalErrors: errorHistory.length,
    unresolvedErrors: errorHistory.filter(log => !log.resolved).length,
    errorsByType: {} as Record<GunErrorType, number>,
    recentErrors: errorHistory.slice(0, 10)
  };
  
  errorHistory.forEach(log => {
    stats.errorsByType[log.error.type] = (stats.errorsByType[log.error.type] || 0) + 1;
  });
  
  return stats;
};

/**
 * Clear error history (for testing/debugging)
 */
export const clearErrorHistory = () => {
  errorHistory = [];
  console.log('Gun.js error history cleared');
};

/**
 * Check if error should be reported to external service
 */
const shouldReportError = (error: GunError): boolean => {
  // Report non-retryable errors and critical connection issues
  return !error.retryable || error.type === GunErrorType.CONNECTION_ERROR;
};

/**
 * Report error to external service (implement based on your error tracking service)
 */
const reportError = (error: GunError, context: string) => {
  // Example implementation - replace with your actual error reporting service
  if (window.location.hostname !== 'localhost') {
    console.log('Would report error to external service:', { error, context });
    // Implement actual error reporting here (e.g., Sentry, LogRocket, etc.)
  }
};

/**
 * Validate Gun.js data before processing
 */
export const validateGunData = (data: any, schema: any): boolean => {
  try {
    // Basic validation - extend as needed
    if (!data) return false;
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!data[field]) return false;
      }
    }
    
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (data[field] && typeof data[field] !== expectedType) return false;
      }
    }
    
    return true;
  } catch (error) {
    console.warn('Data validation error:', error);
    return false;
  }
};

/**
 * Safe data access with error handling
 */
export const safeGunGet = async <T>(
  getter: () => Promise<T>,
  context: string,
  defaultValue?: T
): Promise<T | undefined> => {
  try {
    return await retryOperation(getter, 2, 500, context);
  } catch (error) {
    console.warn(`Safe get failed for ${context}, returning default:`, error);
    return defaultValue;
  }
};