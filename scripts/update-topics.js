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
            Authorization: `bearer ${process.env.GH_TOKEN}`,
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

function makeWordCloud(topicCount) {
    const W = 600, H = 200;
    const placed = [];

    // sort by count descending
    const words = Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1]);

    const maxCount = words[0][1];
    const minCount = words[words.length - 1][1];

    function fontSize(count) {
        if (maxCount === minCount) return 22;
        const t = (count - minCount) / (maxCount - minCount);
        return Math.round(12 + t * 16); // size range in pixel
    }

    function estimateWidth(word, size) {
        return word.length * size * 0.8;
    }

    function overlaps(x, y, w, h) {
        for (const p of placed) {
            if (
                x < p.x + p.w + 8 &&
                x + w + 8 > p.x &&
                y < p.y + p.h + 4 &&
                y + h + 4 > p.y
            ) return true;
        }
        return false;
    }

    function tryPlace(word, size) {
        const w = estimateWidth(word, size);
        const h = size;
        // spiral outward from center
        for (let r = 0; r < 300; r += 3) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
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
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
text { font-family: sans-serif; font-weight: 500; }
.w1 { fill: #0075ca; }
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
    console.log('SVG length:', svg.length);

    const outPath = path.join(__dirname, '..', 'topics.svg');
    fs.writeFileSync(outPath, svg);
    console.log('Written to:', outPath);
})();