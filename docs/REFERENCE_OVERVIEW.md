# Reference Overview

## High-level architecture

- Source notes: your writing, kept as separate notes.
- Recipes: ordered lists of source notes.
- Bundles: ordered lists of recipes.
- Targets: where outputs are written.
- Outputs: generated documents with optional Table of Contents.
- Notices: messages that explain what was generated and highlight issues.

## Execution flow

### Recipe build

A recipe build gathers the listed source notes in order and generates a single output for that recipe. If Table of Contents generation is enabled for the target, the Table of Contents is included in the output.

### Bundle build

A bundle build gathers the listed recipes in order and generates a single output for that bundle. Table of Contents generation, when enabled, reflects the combined structure of those recipes.

## Where Table of Contents fits

Table of Contents generation happens during output creation. It reflects the final order of content at the moment you generate, whether you are building a recipe or a bundle.

## How notices are emitted and aggregated

Notices are created as output is generated. They summarize what Booker wrote and call out issues like missing notes. When you generate multiple outputs, notices are gathered so you can review everything that happened in one place.

## Where backward compatibility applies

Backward compatibility focuses on existing configurations and outputs so that updates do not break your current workflow. If you have older recipe or bundle setups, Booker aims to keep them working as expected.
