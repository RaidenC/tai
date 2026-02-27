const fs = require('fs');
const path = require('path');

const threshold = 20;
const coverageDir = 'coverage';

if (!fs.existsSync(coverageDir)) {
  console.log('No coverage directory found. Skipping check.');
  process.exit(0);
}

let failed = false;

function findCoverageFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findCoverageFiles(file));
    } else if (file.endsWith('coverage-final.json')) {
      results.push(file);
    }
  });
  return results;
}

const coverageFiles = findCoverageFiles(coverageDir);

coverageFiles.forEach(file => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let totalStatements = 0;
  let coveredStatements = 0;

  Object.values(data).forEach(fileData => {
    const statements = fileData.s;
    Object.values(statements).forEach(count => {
      totalStatements++;
      if (count > 0) coveredStatements++;
    });
  });

  const percentage = totalStatements === 0 ? 100 : (coveredStatements / totalStatements) * 100;
  console.log(`${file}: ${percentage.toFixed(2)}% (Target: ${threshold}%)`);

  if (percentage < threshold) {
    failed = true;
  }
});

if (failed) {
  console.error('ERROR: Code coverage is below the threshold!');
  process.exit(1);
} else {
  console.log('SUCCESS: Code coverage threshold met.');
}
