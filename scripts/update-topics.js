const fs = require('fs');
const path = require('path');

const QUERY = `
query($first: Int!) {
  viewer {
    repositories(first: $first, ownerAffiliations: OWNER) {
      nodes {
        repositoryTopics(first: 10) {
          nodes { topic { name } }
        }
      }
    }
  }
}`;

async function fetchTopics() {
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            Authorization: `bearer ${process.env.INPUT_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: QUERY, variables: { first: 100 } }),
    });

    const { data } = await res.json();
    const topicCount = {};
    for (const repo of data.viewer.repositories.nodes) {
        for (const { topic } of repo.repositoryTopics.nodes) {
            const name = topic.name;
            topicCount[name] = (topicCount[name] || 0) + 1;
        }
    }

    return topicCount; // { "javascript": 3, "python": 1, ... }
}

const W = parseInt(process.env.INPUT_SVG_WIDTH || '680');
const H = parseInt(process.env.INPUT_SVG_HEIGHT || '400');
const MIN_FONT = parseInt(process.env.INPUT_MIN_FONT_SIZE || '12');
const MAX_FONT = parseInt(process.env.INPUT_MAX_FONT_SIZE || '28');
const BASE_COLOR = process.env.INPUT_COLOR || '0075ca';
const OUT_FILE = process.env.INPUT_OUTPUT_FILE || 'topics.svg';

function makeWordCloud(topicCount) {
    const placed = [];

    // sort by count descending
    const words = Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1]);

    const maxCount = words[0][1];
    const minCount = words[words.length - 1][1];

    function fontSize(count) {
        if (maxCount === minCount) return 22;
        const t = (count - minCount) / (maxCount - minCount);
        return Math.round(MIN_FONT + t * MAX_FONT); // size range in pixel
    }

    function estimateWidth(word, size) {
        return word.length * size * 0.5;
    }

    function overlaps(x, y, w, h) {
        for (const p of placed) {
            if (
                x < p.x + p.w + 4 &&
                x + w + 4 > p.x &&
                y < p.y + p.h + 2 &&
                y + h + 2 > p.y
            ) return true;
        }
        return false;
    }

    function tryPlace(word, size) {
        const w = estimateWidth(word, size);
        const h = size;
        // spiral outward from center
        for (let r = 0; r < 400; r += 3) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.15) {
                const cx = W / 2 - w / 2 + Math.cos(angle) * r;
                const cy = H / 2 + Math.sin(angle) * r;
                const x = Math.max(10, Math.min(W - w - 10, cx));
                const y = Math.max(size, Math.min(H - 10, cy));
                if (!overlaps(x, y, w, h)) {
                    placed.push({ x, y, w, h });
                    return { x: x + w / 2, y, size };
                }
            }
        }
        return null; // couldn't place
    }

    function colorClass(count) {
        const t = maxCount === minCount ? 0 : (count - minCount) / (maxCount - minCount);
        if (t > 0.75) return 'w1';
        if (t > 0.5) return 'w2';
        if (t > 0.25) return 'w3';
        return 'w4';
    }

    const texts = [];
    for (const [word, count] of words) {
        const size = fontSize(count);
        const pos = tryPlace(word, size);
        if (pos) {
            texts.push(
                `<text class="${colorClass(count)}" x="${pos.x}" y="${pos.y}" ` +
                `font-size="${pos.size}" text-anchor="middle">${word}</text>`
            );
        } else {
            console.warn('Could not place:', word);
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
text { font-family: sans-serif; font-weight: 500; }
.w1 { fill: #${BASE_COLOR}; }
.w2 { fill: #1a8fe0; }
.w3 { fill: #57a8e8; }
.w4 { fill: #8ec4f0; }
</style>
${texts.join('\n')}
</svg>`;
}

(async () => {
    const topicCount = await fetchTopics();
    console.log('Topics found:', JSON.stringify(topicCount, null, 2));

    const svg = makeWordCloud(topicCount);
    const outPath = path.join(process.env.GITHUB_WORKSPACE, OUT_FILE);
    fs.writeFileSync(outPath, svg);

    const { execSync } = require('child_process');

    const cwd = process.env.GITHUB_WORKSPACE;
    const msg = process.env.INPUT_COMMIT_MSG || 'Add topic word cloud';
    const name = process.env.INPUT_COMMIT_USER_NAME || 'github-actions[bot]';
    const email = process.env.INPUT_COMMIT_USER_EMAIL || 'github-actions[bot]@users.noreply.github.com';

    execSync(`git config user.name "${name}"`, { cwd });
    execSync(`git config user.email "${email}"`, { cwd });
    execSync(`git add ${outPath}`, { cwd });

    try {
        execSync('git diff --staged --quiet', { cwd });
        console.log('No changes to commit.');
    } catch {
        execSync(`git commit -m "${msg}"`, { cwd });
        execSync('git push', { cwd });
        console.log('Committed and pushed.');
    }
})();
