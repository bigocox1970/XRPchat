/**
 * Utility function to get the site URL, handling both development and production environments.
 * This ensures redirects work properly in all environments.
 */
export function getSiteURL() {
  // First check for explicit SITE_URL
  let url = import.meta.env.VITE_SITE_URL;
  
  // If not set, use the window.location.origin, which will be correct regardless of environment
  if (!url) {
    url = window.location.origin;
  }

  // Make sure URL has the correct protocol
  if (url && !url.startsWith('http')) {
    url = url.includes('localhost') ? `http://${url}` : `https://${url}`;
  }

  // Ensure URL ends with trailing slash 
  if (url && !url.endsWith('/')) {
    url += '/';
  }

  return url;
}

/**
 * Generates a full URL for redirects, including the path
 */
export function getRedirectURL(path: string) {
  const baseUrl = getSiteURL();
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${baseUrl}${cleanPath}`;
} 