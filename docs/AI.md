# Editing a chart with a language model

A language model can work on a Crownline chart through the `crownline` tools. It can add people, marriages and notes, fix collisions without re-flowing the chart, look at a region as a picture, and compare positions. It changes a chart only through checked operations. Each batch is validated and laid out before it is saved, and it can be undone.

There are two ways in, with the same tools:

- **The MCP server** (`crownline mcp`), for any assistant that speaks the Model Context Protocol, such as Claude Code or Claude Desktop.
- **The command line** (`npm run crownline -- <command>`), for an assistant that runs shell commands, or for you.

[AI_GUIDE.md](AI_GUIDE.md) is the guide written for the model: the style's rules, the working loop, every operation with an example, and a worked session. It is made from the code (`npm run guide`), so it lists exactly the operations the tools accept. Give it to any model that does not load it by itself.

## Claude Code

Nothing to set up. Open Claude Code in this repository:

- `.mcp.json` declares the `crownline` MCP server. Claude Code asks once whether to allow it.
- `.claude/skills/crownline/SKILL.md` is the guide as a skill. Claude Code loads it when you ask for a change to a chart in `charts/`.

Then ask in your own words, for example: *"In the tutorial chart, add Prince Edwin's wife, Lady Isolde of Brackwater, and fix anything it runs into."*

## Another MCP client

Add the server to the client's configuration, with the repository as its working directory:

```json
{
  "mcpServers": {
    "crownline": {
      "command": "node",
      "args": ["--import", "tsx", "packages/cli/src/main.ts", "mcp"],
      "cwd": "/path/to/the/repository"
    }
  }
}
```

The server runs on stdio. Its tools are `crownline_describe`, `crownline_find`, `crownline_read`, `crownline_check`, `crownline_ops`, `crownline_apply`, `crownline_render`, `crownline_diff`, `crownline_history` and `crownline_undo`. The guide comes with it as the prompt `crownline-guide` and the resource `crownline://guide`, and the server's instructions tell the model to read it first.

## The command line

```bash
npm run crownline -- help
```

The commands most worth knowing:

| Command | What it does |
|---|---|
| `charts` | The charts in `charts/` |
| `describe <chart>` | Title, counts, houses, eras, the check's totals, and the document's hash |
| `find <chart> <words…>` | Find people by name, house or year |
| `read <chart> <person>` | A person's facts, parents, marriages, children, notes, adjustments and card |
| `apply <chart> batch.json --reason "…"` | A list of operations, as one batch: all or nothing. `--dry-run` checks it without saving |
| `render <chart> --around a,b` | A region as a PNG, with problems marked |
| `diff <chart> --from last` | What moved in the last batch |
| `undo <chart>` | Undo the last batch |

A chart is named by its id (`tutorial`, `wangsa-mataram`). Add `--json` to any command for JSON output.

## What the tools guarantee

- **The kept layout holds.** On a chart with `layout.lock.json`, everything in the lock stays where it is. New people are placed by their relatives, and kept there once the batch passes the check.
- **A batch with new errors is refused** unless the model asks for it explicitly (`allow_errors`). The refusal says what is wrong and where.
- **Nothing is lost.** Each batch is recorded in `charts/<id>/.crownline/`. `history` lists the batches and `undo` reverses the last.
- **A model never edits the files by hand.** The operations reach every field the schema allows.

The editor picks up a change made by the tools straight away, while it is open (see [EDITOR.md](EDITOR.md#changes-made-outside-the-editor)).

## Reviewing a model's work

- `npm run crownline -- diff <chart> --from HEAD` lists every card that moved since the last commit. Only the people the model meant to move should be on it.
- `npm run crownline -- render <chart> --around <ids>` draws the place it worked on.
- `git diff charts/<id>/chart.json` shows the change to the document. Each adjustment in it carries the model's reason.
- In the editor, the **Adjusted** tab lists the adjustments, and the **Moves** tab lists what moved.
