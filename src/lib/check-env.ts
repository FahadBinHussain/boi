/**
 * Utility to validate if essential environment variables are set
 */
export function checkEnvironmentVariables() {
  const requiredVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DATABASE_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.includes('your-') || value === '';
  });
  
  if (missingVars.length > 0) {
    console.error('⚠️ Missing environment variables:', missingVars);
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

/**
 * Get configured URL for NextAuth callbacks
 */
export function getCallbackUrl() {
  return `${process.env.NEXTAUTH_URL}/api/auth/callback`;
} 