<div align="center">
  
  # Word Cloud Generator for Repository Topics

  A GitHub Action that reads all your repository topics via the GitHub GraphQL API and generates a word cloud SVG.
  
  ![Topics](topics.svg)

  Topics that appear across more repos are displayed larger. Designed to be added to a GitHub profile README.

</div>

---

## How it works

1. A GitHub Action queries the GitHub GraphQL API to get all repository topics
2. Each topic appearance is counted. The more it's used, the bigger its size in the word cloud.
3. A Node.js script places each topic into the world cloud using a spiral algorithm.
4. The resulting SVG is pushed into the repository with the file name `topics.svg`.

---

## Setup

### 1. Create a GitHub token

The action needs a personal access token to query the GraphQL API.

> [!NOTE]
> If you only use this on a public profile repo, you can use the built-in `GITHUB_TOKEN` instead and skip the lengthy steps below. Simply replace `${{ secrets.WORDCLOUD_TOKEN }}` with `${{ secrets.GITHUB_TOKEN }}` in the workflow file.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name like `wordcloud-repo-topics`
4. Under **Scopes**, check `repo` (needed to read repository topics)
5. Click **Generate token** and don't forget to copy it (tokens can only be viewed once)

Then add it to the repo where the word cloud will be added:

1. Go to the repo's **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name it `WORDCLOUD_TOKEN` and paste the generated token as the value

### 2. Add files to the repo

Create `.github/workflows/update-topics.yml` in the repo:

```
name: Add topic word cloud

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Generate word cloud
        uses: stefani-gifta/wordcloud-repo-topics@main
        with:
          token: ${{ secrets.WORDCLOUD_TOKEN }}
```

### 3. Add the SVG to the README

In the `README.md`, add this line where the word cloud should appear:

```markdown
![Topics](topics.svg)
```

It will embed the generated SVG.

### 4. Run it

Go to the repo's **Actions → Add topic word cloud → Run workflow** to trigger it manually the first time. After that it runs every day at midnight UTC.

---

## Customization

In `update-topics.yml`, add any of these to the `with:` block in your workflow file:

| Input | Description | Default |
|---|---|---|
| `token` | GitHub token | required |
| `svg_width` | SVG width in pixels | `680` |
| `svg_height` | SVG height in pixels | `400` |
| `min_font_size` | Smallest word size in pixels | `14` |
| `max_font_size` | Largest word size in pixels | `20` |
| `color` | Base hex color for the cloud | `0075ca` |
| `output_file` | Output SVG filename | `topics.svg` |
| `commit_msg` | Commit message | `Add topic word cloud` |

Example with customization:

```yaml
      - name: Generate word cloud
        uses: stefani-gifta/wordcloud-repo-topics@main
        with:
          token: ${{ secrets.WORDCLOUD_TOKEN }}
          svg_width: '600'
          svg_height: '300'
          min_font_size: '12'
          max_font_size: '28'
          color: '663399'
          commit_msg: '💜 update word cloud'
```

---

## Credits

**Concept and design**: I decided what to build, how it should look, and iterated from badges → inline SVGs → backtick strings → word cloud.

**Placement algorithm and SVG generation** — built with [Claude](https://claude.ai) (Anthropic). The spiral word placement math, overlap detection, and SVG generation were worked out through conversation.

---

## License

This is a free plugin released into the public domain.

See [unlicense.org](https://unlicense.org) for full details.
