# ts-agent

To install dependencies:

```bash
bun install
```

Set environment variables:

```bash
cp .env.example .env
```

Then set `JQUANTS_API_KEY` in `.env`.

To run:

```bash
bun run index.ts
```

To verify APIs:

```bash
bun run verify:api
```

Verify only selected APIs:

```bash
VERIFY_TARGETS=estat,kabucom bun run verify:api
```

To run the minimal vegetable proof scenario:

```bash
bun run verify:scenario
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
