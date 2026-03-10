#!/usr/bin/env bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ "$file_path" == *.cs ]]; then
  echo "Formatting $file_path..." >&2
  dotnet format whitespace --include "$file_path" >&2
fi

echo "{}"
exit 0