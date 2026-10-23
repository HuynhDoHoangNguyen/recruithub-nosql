// MVP access token storage is intentionally memory-only. Reloading the page
// clears this value and requires the user to sign in again.
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => { accessToken = token || null; };
export const removeAccessToken = () => { accessToken = null; };

// Bearer MVP logout is local: there is no refresh session or revocation store.
export const logout = () => removeAccessToken();
