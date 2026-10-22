// Provisional helpers only. Existing runtime routes are not changed until the
// shared API envelope is formally approved.
export function successResponse(data, message = 'Success') {
  return { success: true, data, message };
}

export function errorResponse(code, message, details = []) {
  return {
    success: false,
    error: { code, message, details },
  };
}
