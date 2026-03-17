#!/usr/bin/env bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ "$file_path" == *.cs ]]; then
  echo "Formatting $file_path..." >&2
  # JUNIOR RATIONALE: We run a full 'dotnet format' on the specific file
  # to catch all style and whitespace issues that the CI linter checks for.
  # We use the containing project if possible, otherwise the file itself.
  dotnet format --include "$file_path" >&2
fi

echo "{}"
exit 0
