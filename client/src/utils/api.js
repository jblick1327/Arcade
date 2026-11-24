// api.js - helper for calling the /api routes
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          EXPORTS
//=============================================================

// call the JSON API and return { status, data } - this never throws
// method = 'GET', 'POST', ... / path = path below /api, e.g. '/games' / body = sent as JSON
// status 0 means the request never reached the server; data is null when there was no JSON body
export async function api(method, path, body) {
  try {
    const res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

    // read the JSON body, if there is one
    let data = null;
    try {
      data = await res.json();
    } catch {
      // empty body
    }
    return { status: res.status, data };
  } catch {
    // network error
    return { status: 0, data: null };
  }
}
