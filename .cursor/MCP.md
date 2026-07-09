# MCP setup (CatIntAssist)

Project config: `.cursor/mcp.json`

| Server | Purpose | You must |
|--------|---------|----------|
| **github** | issues, PRs, search, commits | Replace `YOUR_GITHUB_PAT` with a [PAT](https://github.com/settings/tokens) (repo scope as needed). Or use Cursor MCP UI OAuth if offered. |
| **playwright** | click app, repro UI, localhost | First run may download browsers via npx. Enable in Settings → MCP. |
| **context7** | live library docs | Optional API key later for higher limits; works without for basic use. |

## Enable
1. **GitHub:** replace `YOUR_GITHUB_PAT` in `.cursor/mcp.json` *or* put the real token only in user `~/.cursor/mcp.json` / `.cursor/mcp.local.json` (gitignored) — never commit a real PAT
2. Restart Cursor
3. Settings → MCP → green dots on github / playwright / context7

## Later (not now)
- Memory MCP
- Filesystem MCP
- Hooks (dirty-tree gate + post-edit test/build)

## Note
Official GitHub MCP: remote URL above (Cursor ≥0.48). Docker local image is alternative if remote fails — see GitHub install-cursor guide.
