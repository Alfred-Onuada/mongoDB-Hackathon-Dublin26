# GitHub Actions workflow

Use a GitHub Actions workflow to send each pull request (PR) diff to DocDrift.
The workflow writes the review comment on the PR.

Example: the
[langchain-demo workflow](https://github.com/blagoySimandov/langchain-demo/blob/master/.github/workflows/docsdb-bot.yaml).

## How the workflow operates

1. A PR opens, opens again, or gets a new commit.
2. The `pr-unified-diff-action` step writes the full PR diff to a file.
3. The `curl` step sends the diff to `POST /api/describe`.
4. The `jq` command gets the `comment` field from the response.
5. The `create-or-update-comment` step writes the comment on the PR.

## Add the workflow to a repository

1. In the repository, create a GitHub personal access token that can write PR
   comments.
2. Add the token as a repository secret with the name `GH_PERSONAL_TOKEN`.
3. Create the file `.github/workflows/docsdb-bot.yaml`.
4. Copy the workflow below into the file.
5. Change the service URL to the URL of your DocDrift service.
6. Push the file to the default branch.

```yaml
name: Get full PR diff

on:
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: read

jobs:
  get-pr-diff:
    runs-on: ubuntu-latest

    steps:
      - id: diff
        uses: suzuki-shunsuke/pr-unified-diff-action@c932c1df5f577028d8ca05d2d3c0c059072d8821 # v0.0.1

      - name: Send PR diff to describe service
        env:
          DIFF_PATH: ${{ steps.diff.outputs.diff_path }}
        run: |
          jq -Rs '{code: .}' "$DIFF_PATH" \
            | curl --fail-with-body -sS -X POST \
                https://mongodb-hackathon-dublin26-git-320095644118.europe-west1.run.app/api/describe \
                -H 'content-type: application/json' \
                --data-binary @- \
            | jq -r '.comment' > "$RUNNER_TEMP/comment.md"

      - name: Comment docs review on PR
        uses: peter-evans/create-or-update-comment@e8674b075228eee787fea43ef493e45ece1004c9 # v5.0.0
        with:
          token: ${{ secrets.GH_PERSONAL_TOKEN }}
          issue-number: ${{ github.event.pull_request.number }}
          body-path: ${{ runner.temp }}/comment.md
```

## Notes

- The service accepts a maximum of 100000 characters in `code`. If the diff
  is larger, the service sends back status 413 and the job fails.
- The `--fail-with-body` option stops the job if the service sends back an
  error status.
- The workflow token has only read permission. Thus the comment step uses the
  `GH_PERSONAL_TOKEN` secret.
