/**
 * Kilo Code Notification Script
 * Used to send task completion notifications
 */

const args = process.argv.slice(2);
const message = args.join(' ');

console.log('\n' + '='.repeat(60));
console.log('🔔 KILO CODE NOTIFICATION');
console.log('='.repeat(60));
console.log(`📅 Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Singapore' })}`);
console.log('-'.repeat(60));
console.log(`📋 ${message}`);
console.log('='.repeat(60) + '\n');