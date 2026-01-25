// ============================================================================
// API CONFIGURATION AND HELPERS
// ============================================================================

import { host } from './settings.js';

// API Endpoints Registry
export const API_ENDPOINTS = {
    // Device/System endpoints
    PING: '/ping',
    SETTINGS: '/api/settings',
    AP_SETTINGS: '/api/ap_settings',
    REBOOT: '/api/reboot',


};

/**
 * Get the full URL for an API endpoint
 * @param {string} endpoint - The endpoint key from API_ENDPOINTS
 * @returns {string} The full URL
 */
export function getURL(endpoint) {
    if (!API_ENDPOINTS[endpoint]) {
        console.warn(`Unknown endpoint: ${endpoint}`);
        return `${host}${endpoint}`;
    }
    return `${host}${API_ENDPOINTS[endpoint]}`;
}

/**
 * Wrapper around fetch with consistent error handling and logging
 * @param {string} endpointKey - The endpoint key from API_ENDPOINTS or custom path
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpointKey, options = {}) {
    const url = API_ENDPOINTS[endpointKey]
        ? getURL(endpointKey)
        : (endpointKey.startsWith('/') ? `${host}${endpointKey}` : endpointKey);

    try {
        const response = await fetch(url, options);

        // Log failed requests
        if (!response.ok) {
            console.error(`API request failed: ${url}`, response.status, response.statusText);
        }

        return response;
    } catch (error) {
        console.error(`API request error: ${url}`, error);
        throw error;
    }
}

/**
 * Convenience method for GET requests
 * @param {string} endpointKey - The endpoint key or path
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
export async function apiGet(endpointKey, options = {}) {
    return apiFetch(endpointKey, {
        method: 'GET',
        ...options
    });
}

/**
 * Convenience method for POST requests
 * @param {string} endpointKey - The endpoint key or path
 * @param {object} data - Data to send as JSON
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
export async function apiPost(endpointKey, data = null, options = {}) {
    const fetchOptions = {
        method: 'POST',
        ...options
    };

    if (data !== null) {
        fetchOptions.headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        fetchOptions.body = JSON.stringify(data);
    }

    return apiFetch(endpointKey, fetchOptions);
}

/**
 * Convenience method for requests that expect JSON response
 * @param {string} endpointKey - The endpoint key or path
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiFetchJson(endpointKey, options = {}) {
    const response = await apiFetch(endpointKey, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

/**
 * Convenience method for POST requests that expect JSON response
 * @param {string} endpointKey - The endpoint key or path
 * @param {object} data - Data to send
 * @param {object} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiPostJson(endpointKey, data = null, options = {}) {
    const response = await apiPost(endpointKey, data, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}
