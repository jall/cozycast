import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'http://localhost:3001/api';

let baseURL = DEFAULT_BASE_URL;

export function setBaseURL(url) {
  baseURL = url;
}

export function getBaseURL() {
  return baseURL;
}

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && data.message) ||
      (data && typeof data === 'object' && data.error) ||
      `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

const client = {
  async get(path, params) {
    const authHeaders = await getAuthHeaders();
    let url = `${baseURL}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...authHeaders,
      },
    });
    return handleResponse(response);
  },

  async post(path, body) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },

  async postMultipart(path, formData) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseURL}${path}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...authHeaders,
        // Do not set Content-Type — fetch will set it with the boundary
      },
      body: formData,
    });
    return handleResponse(response);
  },

  async put(path, body) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseURL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(response);
  },

  async delete(path) {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${baseURL}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...authHeaders,
      },
    });
    return handleResponse(response);
  },
};

export default client;
