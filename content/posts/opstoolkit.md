+++
title = "OpsToolkit: my own busybox for everything ops"
date = 2024-04-29
draft = false
description = "A single repo with all my scruffy scripts and Docker templates, so I can carry them to any machine and stop googling the same stuff over and over."
tags = ["opstoolkit", "bash", "docker", "devops", "scripts"]
categories = ["devlog"]
series = ["OpsToolkit"]
+++

You know that feeling when you SSH into a fresh machine and need *that* script you
wrote six months ago, the one that lives on your laptop, or maybe on another laptop,
or nowhere at all? I got tired of it.

So I made [OpsToolkit](https://github.com/BorjaIP/opstoolkit). The idea is simple:
one repo with all my "guarreros" scripts — the scruffy, does-the-job ones — so I can
grab them from anywhere and get to work in seconds. Think of it like busybox or the
Ubuntu toolbox image, but instead of `traceroute` and friends, it has *my* tools.

## Pure bash, on purpose

Everything runs on plain bash. No frameworks, no fancy CLI in Go that I have to
rebuild, no Python venv to babysit. Bash is already there, on every machine, and it
always works. Minimalism wins over everything else here: if a script needs a README
to be used, it's too big.

## What lives inside

```
opstoolkit/
├── devcontainer/      # VS Code dev containers (cuda, go, java, python)
├── docker/            # Dockerfiles (angular, python single & multi-stage)
├── docker-compose/    # Ready-to-use stacks
├── git/               # pre-commit config
├── istio/             # gateway, virtual-service, destinationrule, service-entry
├── k8s/               # utility pods (busybox, psql-client)
└── scripts/           # the scruffy ones
```

The biggest time saver is `docker-compose/`. Fourteen stacks I've needed at some
point and don't want to hunt for again: Grafana + Prometheus, Keycloak with its
Postgres, MLflow + MinIO, Jenkins + SonarQube, Kafka UI, DataHub, OpenMetadata, n8n,
InfluxDB, a Kali + DVWA lab, even Firefox over VNC. Clone, `docker compose up`, done.
That's the whole pitch: never search "how do I run Keycloak with docker compose" again.

Same idea for the rest. Need to poke at a cluster? There's a busybox pod and a
psql-client pod ready to `kubectl apply`. Setting up Istio? The four YAMLs I always
end up rewriting are templated there. New project? Grab a devcontainer instead of
configuring the machine.

## The scripts

Two examples of what I mean by "guarreros but useful":

- **`tunnel.sh`** — port-forwards to a database through a pod using socat, with
  sensible defaults and flags for namespace, pod and host. One command instead of
  remembering the socat incantation.
- **`k8s-connectivity-check.sh`** — walks a cluster checking that things actually
  talk to each other, in color, with a timeout. When something is down at 8am, you
  want output, not a research project.

## What it isn't

It's not a product and it's not polished. Some scripts have hardcoded paths that
made sense on the machine where I wrote them. There are no tests, no CI, no
versioning — it's a toolbox, and a toolbox doesn't need a release cycle. If a script
breaks, I fix it the same day I need it, and that's the maintenance plan.

## What's next

Keep throwing things in as I write them, which is honestly the only workflow this
repo needs. Lately it's growing an AI corner (chat-with-models tools landed not long
ago). If you have your own pile of scruffy scripts, I'd recommend the same: one repo,
pure bash, clone it everywhere. Your future SSH session will thank you.
