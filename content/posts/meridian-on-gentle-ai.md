+++
title = "I rebuilt Meridian on top of Gentle AI"
date = 2026-10-10
draft = true
description = "I've been using Gentle AI for a couple of months so I moved Meridian onto its ODD flow."
tags = ["meridian", "gentle-ai", "odd", "engram", "obsidian"]
categories = ["devlog"]
series = ["Meridian"]
+++

I've been using [Gentle AI](https://gentle-ai.gentlemanprogramming.com/) for a couple of months now
and I got used to how it handles memory with [Engram](https://engram.gentlemanprogramming.com/)
and everything around it. The agent saves what it learns as it goes and looks there before asking me again.

So I wanted all that inside my own framework. Meridian was already the place where I keep track
of what I ask agents to do. Why not have everything in one spot?

## What's ODD

The new thing in Gentle AI v4 is ODD, Organic Driven Development. The short version: small changes
stay small and nothing gets planned to death. For bigger work the agent explores first and writes one
task document (`odd/tasks/<name>.md`) with a copy in Engram so the work can be picked up later.
It runs on every request by default so there are no workflow commands to learn.
[Gentle AI explains it better than I do](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/usage.md#organic-driven-development-odd).

That changed what Meridian needed to be. Gentle AI already does the work and remembers it, so my old
plan, approve and run pipeline (and the agent loop) had nothing left to do. I removed them
and went from 14 skills to 7.

## So what is Meridian now?

A ledger. Gentle AI does the work and Meridian keeps the human record: what I asked, when it ran
and where the evidence is.

![How a Meridian task flows](/images/posts/meridian-flow.svg)
*One task from request to archive.*

Here is how a task goes:

1. **I run `/mdn-run "do the thing"`.** That's the only trigger.
2. **Meridian records the task first.** Before any work it writes the task in my vault.
3. **ODD does the work.** It explores, writes the task document and makes the commits. Meridian passes
   the task name so the document gets the same one.
4. **Meridian traces the run.** Dates, branch, commits and PR come from git and gh through a script,
   not from what the model says it did.
5. **It lands in review.** Only I can close it with `/mdn-done`. Review means "go and look at it",
   not "it's correct".
6. **Archive.** `/mdn-archive` moves the done tasks to a monthly log.

## Where everything lives

- **One note per project** in my Obsidian vault: `project.md`, with every task as a `#task` line.
  The states are backlog, in-progress, review and done (plus blocked when something gets stuck).
- **A monthly log** (`logs/YYYY-MM.md`) for archived tasks and a dashboard that reads the notes.
- **The work itself stays in the repo.** The vault only holds pointers to it.

There are seven commands: `init`, `add`, `run`, `done`, `daily`, `status` and `archive`.

## What it doesn't do

It doesn't plan or orchestrate anymore. That's Gentle AI's job now. Also being honest here: I have
run it in a sandbox and on my own vault but nobody else has tried it in a fresh session yet.
The one-line install hasn't been run end to end either.

## What's next

I'll keep iterating on it so it gets more features and a deeper Obsidian integration.
If you want the details the whole rebuild is in [this PR](https://github.com/BorjaIP/meridian/pull/3)
and the [repo](https://github.com/BorjaIP/meridian) has the docs.
