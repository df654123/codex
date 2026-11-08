// SPDX-License-Identifier: GPL-3.0-or-later
// Compatibility check only: JSON transport sends no external email.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve(process.argv[2], 'package.json'));
const nodemailer = require('nodemailer');
assert.equal(require('nodemailer/package.json').version, '10.4.0');
const transport = nodemailer.createTransport({ jsonTransport: true });
const result = await transport.sendMail({ from: 'teacher@example.invalid', to: 'test@example.invalid', subject: 'class4 compatibility', text: 'Synthetic verification only' });
const message = JSON.parse(result.message);
assert.equal(message.subject, 'class4 compatibility');
assert.equal(message.to[0].address, 'test@example.invalid');
transport.close();
console.log('PASS: reviewed mail version and local-only JSON transport compatibility.');
