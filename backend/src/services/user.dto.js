/** Public User representation shared by authentication responses. */
export function toSafeUserDto(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new TypeError('toSafeUserDto requires a User document.');
  }
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    account_status: user.account_status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
