const fs = require('fs');
const path = require('path');

const localTemp = path.join(process.cwd(), '.tmp', 'build-temp');

fs.mkdirSync(localTemp, { recursive: true });

process.env.TMP = localTemp;
process.env.TEMP = localTemp;
process.env.TMPDIR = localTemp;

require('react-scripts/scripts/build');
