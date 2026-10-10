+++
title = "Why I built Meridian"
date = 2026-04-04
draft = true
description = "I wanted my own SDD flow and a way to see what my agents actually did."
tags = ["meridian", "agents", "hitl", "sdd", "obsidian"]
categories = ["devlog"]
series = ["Meridian"]
+++

So, Meridian. It started because I wanted my own SDD. Or at least something I could run one *under*.

I liked the idea of launching things like [Superpowers](https://github.com/obra/superpowers) or
Matt Pocock's [grill-me](https://github.com/mattpocock/skills/tree/main), but I also wanted to keep
track of what happened afterwards: the task I triggered (that's me), the task the agent created from it,
and every state it went through. With me in the loop, validating and verifying each phase, instead of
a "the agent did stuff, trust me".

## Where it lives

In my Obsidian vault. It's my PKM anyway, so why build yet another place? Same structure I already
trust. The agents don't share memory or APIs with me, they just read and write the vault.

## How it goes

I write a task, the agent plans it, I approve it (or tweak it), the agent builds it and I check the
result. The status fields in the notes are the only thing we share. That's it.

## What I want next

I'm still building all this. The idea is to plug in several SDD or RDD frameworks, launch any of them
from any harness and have everything logged: where I ran it from, how and when.

If you want the details, it's all in the [repo](https://github.com/BorjaIP/meridian)
(and the [concepts doc](https://github.com/BorjaIP/meridian/blob/main/docs/concepts.md)).
