export function sessionCookie(name, value, seconds, secure = false) {
  return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
}
