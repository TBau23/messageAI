/**
 * Converts Firebase authentication error codes into user-friendly messages
 * @param {string} errorMessage - The raw Firebase error message
 * @returns {string} User-friendly error message with actionable guidance
 */
export function getFriendlyAuthError(errorMessage) {
  // Extract error code from Firebase error message
  const errorCode = errorMessage.match(/\(([^)]+)\)/)?.[1] || errorMessage;

  switch (errorCode) {
    // Sign In Errors
    case 'auth/user-not-found':
      return "No account found with this email. Please check your email or sign up for a new account.";
    
    case 'auth/wrong-password':
      return "Incorrect password. Please try again or reset your password.";
    
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    
    case 'auth/user-disabled':
      return "This account has been disabled. Please contact support.";
    
    case 'auth/invalid-credential':
      return "Invalid email or password. Please check your credentials and try again.";
    
    // Sign Up Errors
    case 'auth/email-already-in-use':
      return "An account with this email already exists. Please sign in instead.";
    
    case 'auth/weak-password':
      return "Password is too weak. Please use at least 6 characters with a mix of letters and numbers.";
    
    // Network Errors
    case 'auth/network-request-failed':
      return "Network connection failed. Please check your internet connection and try again.";
    
    case 'auth/too-many-requests':
      return "Too many failed attempts. Please wait a few minutes and try again.";
    
    // General Errors
    case 'auth/operation-not-allowed':
      return "This sign-in method is not enabled. Please contact support.";
    
    case 'auth/requires-recent-login':
      return "For security reasons, please sign in again to continue.";
    
    default:
      // If we can't match a specific error, provide a generic but helpful message
      if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        return "Unable to connect. Please check your internet connection and try again.";
      }
      return "An error occurred. Please try again or contact support if the problem persists.";
  }
}

