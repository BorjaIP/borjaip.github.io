+++
title = "Talking to PDFs with Ollama and LLAPRAG"
date = 2024-05-06
draft = false
description = "A small experiment where I download an arXiv paper, index it locally and make a LLM extract the description and key features into an Obsidian note."
tags = ["llaprag", "ollama", "rag", "llama-index", "obsidian"]
categories = ["devlog"]
series = ["LLAPRAG"]
+++

I read a lot of papers and I always do the same thing with them. Open the PDF,
skim the abstract, hunt for what actually matters, and then write a note in my
vault so I never have to open that PDF again. That last part, the note, is the
one that matters. The first parts are just chores.

So I built [LLAPRAG](https://github.com/BorjaIP/llaprag) as an experiment. Can a
local model do the chores for me and hand me a note ready to file?

## The idea

Dead simple. Give it an arXiv URL and get back a structured summary of the paper
with a description, the key features and the takeaways. No cloud API for the model,
because I wanted to play with [Ollama](https://ollama.com/) and llama3 on my own GPU, and
see how far a local setup gets with something as messy as a research PDF.

## How it goes

![How a paper flows through LLAPRAG](/images/posts/llaprag-flow.svg)
*From arXiv URL to a note in the vault.*

1. **Download.** `download.py` grabs the PDF from the arXiv URL into `data/`.
2. **Parse.** [LlamaParse](https://docs.cloud.llamaindex.ai/llamaparse/getting_started)
   turns the PDF into markdown, because feeding raw PDF bytes to a model is how
   you get garbage back.
3. **Index.** LlamaIndex chunks the markdown into nodes, embeds them with a
   HuggingFace embedding model and stores everything in ChromaDB.
4. **Ask.** Queries go to Ollama (llama3), which retrieves from the index and
   answers with the description, the key features and the information I actually want.
5. **File it.** The output lands as a markdown note with frontmatter, straight
   into `articles/papers/` in my Obsidian vault, next to the rest of my reading.

All the moving parts (Ollama with GPU passthrough, ChromaDB, Redis) run with a
single `docker compose up`. Clone, up, run.

## Why RAG and not just "read the PDF"

Because a paper doesn't fit in a context window, and even when it does, dumping
40 pages at a model gives you a mushy summary. Chunking and retrieving means the
model answers over the pieces that matter for the question. It's also the honest
way to experiment with this stuff locally. Embeddings, vector store and LLM are
three separate knobs you can poke at.

## What it isn't

It's an experiment, and it shows. There's a hardcoded LlamaParse key in the code
(yes, I should rotate it), the flow is CLI-and-prints rather than a polished tool,
and it only handles arXiv URLs, anything else falls through. It was never meant
to be a product; it was meant to answer "does this work on my machine with my
papers?" It does.

## Why it mattered

This was the seed of something bigger. Once you see a model turn a PDF into a
clean, structured note that files itself into your vault, you start wanting the
same for everything else you read, like blog posts, docs and repos. That itch is
what ended up shaping how I capture knowledge into my PKM.

The code is in the [repo](https://github.com/BorjaIP/llaprag) and it is small
enough to read in one sitting, which was the other point.
