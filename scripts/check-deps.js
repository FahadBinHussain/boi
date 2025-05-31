const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Checking for required dependencies...');

// Check if autoprefixer is installed
try {
  require.resolve('autoprefixer');
  console.log('✅ autoprefixer is installed');
} catch (e) {
  console.log('⚠️ autoprefixer is not installed, installing now...');
  try {
    execSync('pnpm install -D autoprefixer@^10.4.18', { stdio: 'inherit' });
    console.log('✅ autoprefixer installed successfully');
  } catch (err) {
    console.error('❌ Failed to install autoprefixer:', err);
    process.exit(1);
  }
}

// Check if postcss-color-rgba-fallback is installed
try {
  require.resolve('postcss-color-rgba-fallback');
  console.log('✅ postcss-color-rgba-fallback is installed');
} catch (e) {
  console.log('⚠️ postcss-color-rgba-fallback is not installed, installing now...');
  try {
    execSync('pnpm install -D postcss-color-rgba-fallback@^4.0.0', { stdio: 'inherit' });
    console.log('✅ postcss-color-rgba-fallback installed successfully');
  } catch (err) {
    console.error('❌ Failed to install postcss-color-rgba-fallback:', err);
    process.exit(1);
  }
}

// Check if @tailwindcss/forms is installed
try {
  require.resolve('@tailwindcss/forms');
  console.log('✅ @tailwindcss/forms is installed');
} catch (e) {
  console.log('⚠️ @tailwindcss/forms is not installed, installing now...');
  try {
    execSync('pnpm install -D @tailwindcss/forms@^0.5.10', { stdio: 'inherit' });
    console.log('✅ @tailwindcss/forms installed successfully');
  } catch (err) {
    console.error('❌ Failed to install @tailwindcss/forms:', err);
    process.exit(1);
  }
}

console.log('✅ All required dependencies are installed'); 