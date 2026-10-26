This is the wiki repo for the plugin **CommandBridge**.

- built with **Nunjucks** and **TailwindCSS**  
- deployed using **Cloudflare Pages**  
- contains all documentation for the plugin

## Development

Clone and start the dev server:

```bash
git clone https://github.com/objz/CommandBridge-wiki
cd CommandBridge-wiki
npm install
npm run dev
```

## Relay and dump worker

`worker/` contains the Cloudflare Worker used by setup, the editor, and support dumps. It deploys separately from the Pages site; see [worker/README.md](worker/README.md) for local tests and deployment configuration.
