#!/usr/bin/env node

/**
 * Environment Variable Checker
 * 
 * This script checks for required environment variables and provides guidance
 * on setting them up correctly.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Define required environment variables
const requiredVars = [
  { 
    name: 'DATABASE_URL', 
    description: 'PostgreSQL connection string for your database',
    example: 'postgresql://username:password@localhost:5432/mydb',
    generateExample: false,
  },
  { 
    name: 'API_ENCRYPTION_KEY', 
    description: '64-character hex string (32 bytes) for encrypting API keys',
    example: '[auto-generated]',
    generateExample: true,
    generator: () => crypto.randomBytes(32).toString('hex'),
  },
  { 
    name: 'NEXTAUTH_SECRET', 
    description: 'Secret for NextAuth.js session encryption',
    example: '[auto-generated]',
    generateExample: true,
    generator: () => crypto.randomBytes(32).toString('base64'),
  },
  { 
    name: 'NEXTAUTH_URL', 
    description: 'Base URL of your application for NextAuth.js',
    example: 'http://localhost:3000',
    generateExample: false,
  },
];

// Check if .env.local exists, and create it if it doesn't
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('\n📝 Creating .env.local file...');
  fs.writeFileSync(envPath, '# Environment Variables\n\n');
} else {
  console.log('\n🔍 Checking existing .env.local file...');
}

// Read existing .env.local file
const envContent = fs.readFileSync(envPath, 'utf8');

// Check each required variable
let missingVars = [];
let updatedContent = envContent;

requiredVars.forEach(({ name, description, example, generateExample, generator }) => {
  if (!envContent.includes(`${name}=`)) {
    missingVars.push(name);
    
    // Generate example value if needed
    const exampleValue = generateExample && generator ? generator() : example;
    
    // Add to updated content
    updatedContent += `\n# ${description}\n${name}=${exampleValue}\n`;
  }
});

// Update .env.local if needed
if (missingVars.length > 0) {
  fs.writeFileSync(envPath, updatedContent);
  console.log('\n⚠️ Added the following missing environment variables to .env.local:');
  missingVars.forEach(name => console.log(`   - ${name}`));
  console.log('\n⚠️ Please review and update the values in .env.local as needed.');
} else {
  console.log('\n✅ All required environment variables are set.');
}

// Check database connection
try {
  console.log('\n🔍 Checking database connection...');
  execSync('npx prisma db pull', { stdio: 'inherit' });
  console.log('\n✅ Database connection successful.');
} catch (error) {
  console.log('\n❌ Database connection failed. Please check your DATABASE_URL in .env.local.');
}

console.log('\n📋 Environment Setup Guide:');
console.log('\n1. Make sure your PostgreSQL database is running.');
console.log('2. Update DATABASE_URL in .env.local with your database connection string.');
console.log('3. Ensure API_ENCRYPTION_KEY is a 64-character hex string (32 bytes).');
console.log('4. Run the following commands to set up your database:\n');
console.log('   npx prisma migrate dev');
console.log('   npx prisma generate\n');

console.log('5. Restart your development server with:\n');
console.log('   npm run dev\n');

console.log('For more information, please refer to the project documentation.\n'); 