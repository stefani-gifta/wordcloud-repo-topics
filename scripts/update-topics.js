const fs = require('fs');

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
  const topicSet = new Set();

  for (const repo of data.viewer.repositories.nodes) {
    for (const { topic } of repo.repositoryTopics.nodes) {
      topicSet.add(topic.name);
    }
  }

  return [...topicSet].sort();
}

function makeBadge(topic) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24">
    <rect width="120" height="24" rx="12" fill="#ddf4ff"/>
    <text x="60" y="16" font-family="sans-serif" font-size="12"
      fill="#0969da" text-anchor="middle">${topic}</text>
  </svg>`;

  const encoded = encodeURIComponent(svg);
  return `<a href="https://github.com/topics/${topic}"><img src="data:image/svg+xml,${encoded}" alt="${topic}"></a>`;
}

function formatTopics(topics) {
  const badges = topics.map(makeBadge).join('\n');
  return `<!-- TOPICS_START -->\n${badges}\n<!-- TOPICS_END -->`;
}

(async () => {
  const topics = await fetchTopics();
  const topicsList = formatTopics(topics);

  let readme = fs.readFileSync('README.md', 'utf8');
  readme = readme.replace(
    /<!-- TOPICS_START -->[\s\S]*?<!-- TOPICS_END -->/,
    topicsList
  );
  fs.writeFileSync('README.md', readme);
  console.log(`Updated ${topics.length} topics.`);
})();