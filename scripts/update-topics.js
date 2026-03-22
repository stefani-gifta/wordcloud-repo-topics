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

function formatTopics(topics) {
  const spans = topics
    .map(t => "[`${t}`](https://github.com/topics/${t})")
    .join(' ');

  return `<!-- TOPICS_START -->\n${spans}\n<!-- TOPICS_END -->`;
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